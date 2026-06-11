import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp';

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
