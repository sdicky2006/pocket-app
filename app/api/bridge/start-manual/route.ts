import { NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

export async function POST() {
  try {
    // Check if we're in a serverless environment (Vercel)
    if (process.env.VERCEL || process.env.LAMBDA_TASK_ROOT) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Browser automation not available in serverless environment',
        hint: 'Use manual setup instead. Go to /api/bridge/browser-launch for instructions.',
        status: 'serverless_limitation',
        manualSetupUrl: '/api/bridge/browser-launch'
      }, { status: 400 });
    }
    
    const status = await wsBridge.startManual();
    if (status.status === 'error') {
      return NextResponse.json({ ok: false, hint: 'Failed to launch browser. Ensure Playwright browsers are installed and this app can open windows.', ...status }, { status: 500 });
    }
    return NextResponse.json({ ok: status.status === 'connecting' || status.status === 'connected', ...status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
