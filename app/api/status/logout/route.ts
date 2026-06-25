import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  jar.delete('admin_token');

  const loginUrl = new URL('/ai-agent-voice/status/login', req.url);
  return NextResponse.redirect(loginUrl);
}
