import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-hume-secret');
  if (!secret || secret !== process.env.HUME_TOOL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerName, callerPhone, startTime } = body as {
    callerName?: string; callerPhone?: string; startTime?: string;
  };

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { error: 'callerName, callerPhone and startTime are required' },
      { status: 400 }
    );
  }

  const result = await bookMeeting({ callerName, callerPhone, startTime });
  // Return 200 even on failure: Hume treats non-200 as a network error and retries.
  return NextResponse.json(result);
}
