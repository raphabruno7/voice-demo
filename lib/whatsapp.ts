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

/** Sends a WhatsApp notification to Raphael. Prefers the OpenClaw bridge (PT
 * number); falls back to the Twilio sandbox if the bridge isn't configured
 * or fails. */
export async function sendWhatsApp(message: string): Promise<void> {
  try {
    if (await sendViaBridge(message)) return;
  } catch (e) {
    console.error('[whatsapp] bridge send failed, falling back to Twilio:', e);
  }
  await sendViaTwilio(message);
}
