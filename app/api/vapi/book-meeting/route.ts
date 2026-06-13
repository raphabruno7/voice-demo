import { NextRequest, NextResponse } from 'next/server';
import { bookMeeting } from '@/lib/book-meeting';

type VapiToolCall = { id: string; function: { name: string; arguments: unknown } };

function parseArgs(raw: unknown): { callerName?: string; callerPhone?: string; startTime?: string } {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return (raw as Record<string, string>) ?? {};
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const calls: VapiToolCall[] = body?.message?.toolCallList ?? body?.message?.toolCalls ?? [];

  const results = await Promise.all(
    calls.map(async (call) => {
      const { callerName, callerPhone, startTime } = parseArgs(call.function?.arguments);
      if (!callerName || !callerPhone || !startTime) {
        return { toolCallId: call.id, result: 'Faltam dados para marcar. Pede nome, telefone e hora.' };
      }
      const r = await bookMeeting({ callerName, callerPhone, startTime });
      return {
        toolCallId: call.id,
        result: r.success
          ? `Ficou marcado para ${r.meetingTime}. O Raphael fala contigo em breve.`
          : 'Não consegui criar o evento agora. O Raphael contacta-te directamente.',
      };
    })
  );

  return NextResponse.json({ results });
}
