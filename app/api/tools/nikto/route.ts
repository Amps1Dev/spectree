import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const { target } = await request.json();

    if (!target || target === 'localhost' || target === '127.0.0.1') {
      return NextResponse.json(
        { error: 'Invalid target' },
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const nikto = spawn('nikto', ['-h', target]);

        nikto.stdout.on('data', (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        nikto.stderr.on('data', (data) => {
          controller.enqueue(encoder.encode(`Error: ${data.toString()}`));
        });

        nikto.on('close', (code) => {
          if (code !== 0) {
            controller.enqueue(encoder.encode(`\nNikto exited with code ${code}`));
          }
          controller.close();
        });

        nikto.on('error', (err) => {
          controller.enqueue(encoder.encode(`Error: ${err.message}`));
          controller.close();
        });
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Nikto API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute nikto' },
      { status: 500 },
    );
  }
}
