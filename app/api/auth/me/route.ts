import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

const decryptData = (encryptedData: string): string => {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export async function GET(request: NextRequest) {
  try {
    const encryptedSessionData = request.cookies.get('pocket-session-data')?.value;
    if (!encryptedSessionData) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let sessionData: any = null;
    try {
      const decrypted = decryptData(encryptedSessionData);
      sessionData = JSON.parse(decrypted);
    } catch {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: sessionData.email,
        userId: sessionData.userId,
        lastActivity: sessionData.lastActivity,
        sessionExpiry: sessionData.sessionExpiry,
      },
    });
  } catch (e) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
