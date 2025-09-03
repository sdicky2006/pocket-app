import { NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const status = await wsBridge.startManual();
    if (status.status === 'error') {
      return NextResponse.json({ ok: false, hint: 'Failed to launch browser. Ensure Playwright browsers are installed and this app can open windows.', ...status }, { status: 500 });
    }
    return NextResponse.json({ ok: status.status === 'connecting' || status.status === 'connected', ...status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
