import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerName, startTime } = body as { callerName?: string; startTime?: string };

  if (!callerName || !startTime) {
    return NextResponse.json(
      { error: 'callerName and startTime are required' },
      { status: 400 }
    );
  }

  try {
    const event = await createEvent({ callerName, startTime });
    const formattedTime = new Date(startTime).toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Lisbon',
    });

    return NextResponse.json({
      success: true,
      eventId: event.eventId,
      meetingTime: formattedTime,
    });
  } catch (err) {
    console.error('[/api/calendar] createEvent failed:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to create calendar event',
    });
  }
}
