import { NextRequest, NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ ok: false, error: 'email and password required' }, { status: 400 });
    const status = await wsBridge.start(email, password);
    return NextResponse.json({ ok: status.status === 'connected', ...status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
