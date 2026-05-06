import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

const PROFILE_FLAGS: Record<string, string> = {
  Quick: '-T4 -F',
  Service: '-sV -T4',
  Full: '-sV -A -T4',
};

export async function POST(request: NextRequest) {
  try {
    const { target, profile = 'Quick' } = await request.json();

    if (!target || target === 'localhost' || target === '127.0.0.1') {
      return NextResponse.json(
        { error: 'Invalid target' },
        { status: 400 },
      );
    }

    const flags = PROFILE_FLAGS[profile] || PROFILE_FLAGS.Quick;
    const args = flags.split(' ').concat([target]);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        const nmap = spawn('nmap', args);

        nmap.stdout.on('data', (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        nmap.stderr.on('data', (data) => {
          controller.enqueue(encoder.encode(`Error: ${data.toString()}`));
        });

        nmap.on('close', (code) => {
          if (code !== 0) {
            controller.enqueue(encoder.encode(`\nNmap exited with code ${code}`));
          }
          controller.close();
        });

        nmap.on('error', (err) => {
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
    console.error('Nmap API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute nmap' },
      { status: 500 },
    );
  }
}
