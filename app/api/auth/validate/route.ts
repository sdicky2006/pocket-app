import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

// Decrypt sensitive data
const decryptData = (encryptedData: string): string => {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export async function GET(request: NextRequest) {
  try {
    // Get session cookies
    const sessionToken = request.cookies.get('pocket-session')?.value;
    const encryptedSessionData = request.cookies.get('pocket-session-data')?.value;

    if (!sessionToken || !encryptedSessionData) {
      return NextResponse.json(
        { valid: false, error: 'No session found' },
        { status: 401 }
      );
    }

    // Decrypt session data
    let sessionData;
    try {
      const decryptedData = decryptData(encryptedSessionData);
      sessionData = JSON.parse(decryptedData);
    } catch (error) {
      return NextResponse.json(
        { valid: false, error: 'Invalid session data' },
        { status: 401 }
      );
    }

    // Check if session has expired
    if (sessionData.sessionExpiry && Date.now() > sessionData.sessionExpiry) {
      return NextResponse.json(
        { valid: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    // Update last activity (in production, you'd update this in your database)
    sessionData.lastActivity = Date.now();

    return NextResponse.json({
      valid: true,
      user: {
        email: sessionData.email,
        userId: sessionData.userId,
        lastActivity: sessionData.lastActivity
      }
    });

  } catch (error) {
    console.error('Session validation error:', error);
    
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
