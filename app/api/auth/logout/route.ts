import { NextRequest, NextResponse } from 'next/server';
import { deleteCredentials } from '@/lib/secureStore';

export async function POST(request: NextRequest) {
  try {
    // Attempt to identify user email from a header or cookie if available in the future.
    // For now, rely on client to pass email to a logout endpoint variant if desired.

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear session cookies
    response.cookies.set('pocket-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    response.cookies.set('pocket-session-data', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    // Optional: if client sends email in headers, clear stored credentials
    const email = request.headers.get('x-user-email');
    if (email) {
      deleteCredentials(email);
    }

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-email',
    },
  });
}
