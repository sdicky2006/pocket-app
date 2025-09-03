import { NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

let recentFrames: Array<{ direction: 'in' | 'out'; url: string; payload: string; ts: number }> = [];
const MAX_FRAMES = 50;

// Subscribe once per module load to collect recent frames for status inspection
wsBridge.onFrame((evt) => {
  recentFrames.push(evt);
  if (recentFrames.length > MAX_FRAMES) recentFrames = recentFrames.slice(-MAX_FRAMES);
});

export async function GET() {
  try {
    const status = await wsBridge.getStatus();
    const quotes = wsBridge.getLatestQuotes().slice(0, 25);
    return NextResponse.json({ ok: true, ...status, recentFrames, quotes });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
