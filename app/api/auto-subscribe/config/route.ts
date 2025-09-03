import { NextRequest, NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, config: wsBridge.getAutoSubscribeConfig() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    wsBridge.setAutoSubscribeConfig(body || {});
    return NextResponse.json({ ok: true, config: wsBridge.getAutoSubscribeConfig() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}



