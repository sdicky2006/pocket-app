import { NextRequest, NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export async function POST() {
  try {
    const status = await wsBridge.stop();
    return NextResponse.json({ ok: status.status === 'stopped', ...status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
