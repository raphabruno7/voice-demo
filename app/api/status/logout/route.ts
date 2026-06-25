import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  jar.delete('admin_token');

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/status/login';
  return NextResponse.redirect(loginUrl);
}
