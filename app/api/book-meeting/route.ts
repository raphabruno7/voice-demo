import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/google-calendar';

async function sendWhatsApp(body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const to = process.env.TWILIO_WHATSAPP_TO;
  if (!sid || !token || !to) return;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: 'whatsapp:+14155238886',
      To: to,
      Body: body,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

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

    sendWhatsApp(
      `📅 Novo agendamento via Ana\n\nNome: ${callerName}\nTelefone: ${callerPhone}\nHora: ${meetingTime}`
    ).catch((e) => console.error('[/api/book-meeting] WhatsApp failed:', e));

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
