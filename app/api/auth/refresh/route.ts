import { NextRequest, NextResponse } from 'next/server';

// Small random delay to mimic human/network variability
const addRandomDelay = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 350));

export async function POST(request: NextRequest) {
  try {
    await addRandomDelay();

    const session = request.cookies.get('pocket-session')?.value;
    const sessionDataEnc = request.cookies.get('pocket-session-data')?.value;

    if (!session || !sessionDataEnc) {
      return NextResponse.json({ ok: false, reason: 'no-session' }, { status: 401 });
    }

    // Rolling extension with jitter (between 15–25 minutes) for active sessions
    const extraSeconds = Math.floor(15 * 60 + Math.random() * (10 * 60));

    const res = NextResponse.json({ ok: true, extendedBySec: extraSeconds });

    // Refresh cookies (httpOnly) to extend expiry quietly
    res.cookies.set('pocket-session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: extraSeconds, // extend window relative to now
      path: '/',
    });

    res.cookies.set('pocket-session-data', sessionDataEnc, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: extraSeconds,
      path: '/',
    });

    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
