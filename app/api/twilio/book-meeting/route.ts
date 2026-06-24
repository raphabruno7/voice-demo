import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-twilio-agent-secret');
  if (!secret || secret !== process.env.TWILIO_AGENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { callerName?: string; callerPhone?: string; startTime?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { callerName, callerPhone, startTime } = body;
  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json(
      { result: 'Faltam dados para marcar. Pede nome, telefone e hora.' },
      { status: 200 }
    );
  }

  const r = await bookMeeting({ callerName, callerPhone, startTime });
  return NextResponse.json({
    result: r.success
      ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
      : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
  });
}
