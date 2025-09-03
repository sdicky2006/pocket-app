import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Pocket-APP is working!',
    timestamp: new Date().toISOString(),
    env: {
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      nodeEnv: process.env.NODE_ENV
    }
  });
}
