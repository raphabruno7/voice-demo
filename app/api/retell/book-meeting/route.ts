import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-retell-secret');
  if (!secret || secret !== process.env.RETELL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const args = (body?.args ?? {}) as { callerName?: string; callerPhone?: string; startTime?: string };
  const { callerName, callerPhone, startTime } = args;

  if (!callerName || !callerPhone || !startTime) {
    return NextResponse.json({ result: 'Faltam dados para marcar. Pede nome, telefone e hora.' });
  }

  const r = await bookMeeting({ callerName, callerPhone, startTime });
  return NextResponse.json({
    result: r.success
      ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
      : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
  });
}
