import { NextRequest, NextResponse } from 'next/server';
import { getVulnerabilities, clearVulnerabilities } from '@/lib/store';

export async function GET() {
  try {
    const vulns = getVulnerabilities();
    return NextResponse.json({ vulnerabilities: vulns });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load vulnerabilities' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearVulnerabilities();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear vulnerabilities' }, { status: 500 });
  }
}