import { NextRequest, NextResponse } from 'next/server';

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
    console.error('[/api/transfer-fallback] bridge send failed, falling back to Twilio:', e);
  }
  await sendViaTwilio(message);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { callerPhone, reason } = body as {
    callerPhone?: string;
    reason?: string;
  };

  try {
    await sendWhatsApp(
      `📞 Transferência falhou — chamada Ana\n\nTelefone: ${callerPhone || 'desconhecido'}\nMotivo: ${reason || 'não especificado'}\n\nPor favor, ligar de volta.`
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[/api/transfer-fallback] WhatsApp failed:', e);
    // Return 200: the agent treats any non-200 as a network error and may retry.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
