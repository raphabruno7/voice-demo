import { NextResponse } from 'next/server';

export async function POST() {
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
