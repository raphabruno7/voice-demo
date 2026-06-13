import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_TWIML_APP_SID) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 });
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, { identity: 'web-visitor' });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: TWILIO_TWIML_APP_SID, incomingAllow: false }));

  return NextResponse.json({ token: token.toJwt() });
}
