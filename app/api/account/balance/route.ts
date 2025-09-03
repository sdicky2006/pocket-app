import { NextRequest, NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    // Try to read balance via DOM (non-invasive, no navigation)
    const page = (wsBridge as any).page as import('@playwright/test').Page | null;
    let balance: number | null = null;
    let currency: string | null = null;
    if (page) {
      try {
        // Heuristics: scan for typical balance widgets
        const res = await page.evaluate(() => {
          const out: { text: string; title?: string }[] = [];
          const nodes = document.querySelectorAll('[class*="balance" i], [data-balance], [aria-label*="balance" i], [class*="funds" i], header');
          nodes.forEach(el => {
            const t = (el.textContent || '').trim();
            if (t) out.push({ text: t, title: (el as HTMLElement).title });
          });
          return out.slice(0, 10);
        });
        const texts = (res || []).map((x: any) => `${x.title || ''} ${x.text}`);
        const joined = texts.join(' \n ');
        const m = joined.match(/([£$€]|USD|USDT|EUR|GBP)\s?([0-9][0-9,.]+)/i) || joined.match(/([0-9][0-9,.]+)\s?(USD|USDT|EUR|GBP|\$|£|€)/i);
        if (m) {
          const num = parseFloat(m[2].replace(/[, ]/g, ''));
          balance = Number.isFinite(num) ? num : null;
          currency = m[1] || m[2] || null;
        }
      } catch {}
    }
    return NextResponse.json({ ok: true, balance, currency, account: wsBridge.getAutoTradeConfig().account });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}


