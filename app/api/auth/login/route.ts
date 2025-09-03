import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { saveCredentials } from '@/lib/secureStore';
import { allowRequest, randomHumanDelay, randomizeHeaders } from '@/lib/stealth';

// Anti-detection: Randomize response times
const addRandomDelay = () => {
  return new Promise(resolve => {
    const delay = 800 + Math.random() * 1200; // 800-2000ms
    setTimeout(resolve, delay);
  });
};

// Simulate realistic User-Agent headers
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Encrypt sensitive data
const encryptData = (data: string): string => {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  return CryptoJS.AES.encrypt(data, key).toString();
};

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate session token
const generateSessionToken = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Mock function to simulate Pocket Option authentication
const authenticateWithPocketOption = async (email: string, password: string) => {
  // Add anti-detection delay
  await addRandomDelay();

  // Simulate different response scenarios
  const random = Math.random();
  
  if (random < 0.1) {
    // 10% chance of network error simulation
    throw new Error('Network timeout');
  }
  
  if (random < 0.2) {
    // 10% chance of invalid credentials
    return { success: false, error: 'Invalid credentials' };
  }

  // For demo purposes, accept any email/password combination
  // In production, this would make actual API calls to Pocket Option
  if (email && password && password.length >= 6) {
    return {
      success: true,
      sessionData: {
        userId: 'user_' + Date.now(),
        email: email,
        sessionExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        lastActivity: Date.now(),
      }
    };
  }

  return { success: false, error: 'Invalid credentials' };
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    if (!allowRequest(`login:${ip}`, 5, 2)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    await randomHumanDelay(220, 700);
    const _headers = randomizeHeaders();

    const body = await request.json();
    const { email, password, rememberMe } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Attempt authentication with Pocket Option
    const authResult = await authenticateWithPocketOption(email, password);

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Persist encrypted credentials in secure store only if user opted in
    if (rememberMe) {
      // 30 days TTL; change per policy
      saveCredentials(email, password, 30 * 24 * 60 * 60 * 1000);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    
    // Encrypt session data
    const encryptedSessionData = encryptData(JSON.stringify(authResult.sessionData));

    // Set session expiry based on remember me option
    const sessionExpiry = rememberMe 
      ? Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
      : Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      sessionExpiry: sessionExpiry,
      user: {
        email: email,
        sessionId: sessionToken.substring(0, 8) + '...' // Partial token for client reference
      }
    });

    // Set secure HTTP-only session cookie
    response.cookies.set('pocket-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // seconds
      path: '/'
    });

    // Set encrypted session data cookie
    response.cookies.set('pocket-session-data', encryptedSessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
      path: '/'
    });

    // Add anti-detection headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;

  } catch (error) {
    console.error('Authentication error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
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
