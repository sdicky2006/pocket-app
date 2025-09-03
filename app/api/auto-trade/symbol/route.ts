import { NextRequest, NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sym = String(body?.symbol || '');
    wsBridge.setPreferredSymbol(sym || null);
    return NextResponse.json({ ok: true, symbol: wsBridge.getPreferredSymbol() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, symbol: wsBridge.getPreferredSymbol() });
}


