import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /status — skip /status/login and /api/status/*
  if (
    !pathname.startsWith('/status') ||
    pathname.startsWith('/status/login') ||
    pathname.startsWith('/api/status')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_token')?.value;
  const secret = process.env.ADMIN_SECRET;

  // Fail open: if ADMIN_SECRET is not set (local dev), allow through
  if (!secret) {
    return NextResponse.next();
  }

  if (token !== secret) {
    const loginUrl = new URL('/ai-agent-voice/status/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/status', '/status/:path*'],
};
