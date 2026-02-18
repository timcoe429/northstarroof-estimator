import { NextRequest, NextResponse } from 'next/server';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

const LOG_PATH = join(process.cwd(), '.cursor', 'debug.log');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const line = JSON.stringify(body) + '\n';
    await mkdir(join(process.cwd(), '.cursor'), { recursive: true });
    await appendFile(LOG_PATH, line);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
