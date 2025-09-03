import { NextRequest } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export const runtime = 'nodejs';

// Server-Sent Events endpoint to stream captured websocket frames and quotes
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      write('retry: 1500\n\n');

      const offFrame = wsBridge.onFrame((evt) => {
        try {
          write(`event: message\n`);
          write(`data: ${JSON.stringify(evt)}\n\n`);
        } catch {}
      });
      const offQuote = wsBridge.onQuote((q) => {
        try {
          write(`event: quote\n`);
          write(`data: ${JSON.stringify(q)}\n\n`);
        } catch {}
      });

      const heartbeat = setInterval(() => {
        try { write(`: ping ${Date.now()}\n\n`); } catch {}
      }, 10000);

      const close = () => {
        try { offFrame(); } catch {}
        try { offQuote(); } catch {}
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      const signal = req.signal as AbortSignal | undefined;
      if (signal) {
        if (signal.aborted) close(); else signal.addEventListener('abort', close, { once: true });
      }
    },
    cancel() {}
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}


