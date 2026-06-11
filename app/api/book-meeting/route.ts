import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-hume-secret');
  if (!secret || secret !== process.env.HUME_TOOL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerName, callerPhone, startTime } = body as {
    callerName?: string;
    callerPhone?: string;
    startTime?: string;
  };

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { error: 'callerName, callerPhone and startTime are required' },
      { status: 400 }
    );
  }

  try {
    await createEvent({ callerName, callerPhone, startTime });
    const meetingTime = new Date(startTime).toLocaleString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Lisbon',
    });

    // Await the WhatsApp send so the serverless function doesn't terminate mid-flight.
    // Tradeoff: ~500ms added to response; in exchange the notification reliably ships.
    try {
      await sendWhatsApp(
        `📅 Novo agendamento via Ana\n\nNome: ${callerName}\nTelefone: ${callerPhone}\nHora: ${meetingTime}`
      );
    } catch (e) {
      console.error('[/api/book-meeting] WhatsApp failed:', e);
    }

    return NextResponse.json({ success: true, meetingTime });
  } catch (err) {
    console.error('[/api/book-meeting] createEvent failed:', err);
    // Return 200: Hume treats any non-200 as network error and retries indefinitely.
    // Signal failure via response body instead.
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar event' },
      { status: 200 }
    );
  }
}
