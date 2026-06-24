import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const TWIML_URL = 'https://voice-demo-navy.vercel.app/ai-agent-voice/api/twilio/twiml';

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = req.headers.get('x-twilio-signature') ?? '';
    const valid = twilio.validateRequest(authToken, signature, TWIML_URL, {});
    if (!valid) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const relay = process.env.TWILIO_AGENT_WSS_URL;
  if (!relay) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-PT">A demonstração ainda não está disponível. Volta em breve.</Say></Response>`,
      { headers: { 'content-type': 'text/xml' } }
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${relay}" ttsProvider="amazon" voice="Polly.Ines-Neural" language="pt-PT" /></Connect></Response>`;
  return new NextResponse(xml, { headers: { 'content-type': 'text/xml' } });
}
