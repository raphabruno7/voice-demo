import { NextRequest, NextResponse } from 'next/server';
import { createEvent } from '@/lib/google-calendar';

async function sendViaBridge(message: string): Promise<boolean> {
  const url = process.env.WHATSAPP_BRIDGE_URL;
  const secret = process.env.WHATSAPP_BRIDGE_SECRET;
  if (!url || !secret) return false;

  const res = await fetch(`${url.replace(/\/$/, '')}/notify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bridge-secret': secret,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Bridge ${res.status}: ${await res.text()}`);
  return true;
}

async function sendViaTwilio(message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const to = process.env.TWILIO_WHATSAPP_TO;
  if (!sid || !token || !to) return false;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: 'whatsapp:+14155238886',
      To: to,
      Body: message,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return true;
}

async function sendWhatsApp(message: string): Promise<void> {
  // Prefer bridge (PT number via OpenClaw); fall back to Twilio sandbox.
  try {
    if (await sendViaBridge(message)) return;
  } catch (e) {
    console.error('[/api/book-meeting] bridge send failed, falling back to Twilio:', e);
  }
  await sendViaTwilio(message);
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
