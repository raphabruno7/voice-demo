import { NextRequest, NextResponse } from 'next/server';
import { getOutboundAppointment } from '@/lib/appointments';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/whatsapp';
import { formatPtDateTime } from '@/lib/format';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appointmentId } = (await req.json()) as { appointmentId?: string };
  if (!appointmentId) {
    return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 200 });
  }

  const appointment = await getOutboundAppointment(appointmentId);
  if (!appointment) {
    return NextResponse.json({ success: false, error: 'appointment not found' }, { status: 200 });
  }

  await getSupabaseAdmin()
    .from('outbound_appointments')
    .update({ reminder_status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);

  try {
    await sendWhatsApp(
      `✅ Marcação confirmada via agente de voz\n\nCliente: ${appointment.client_name || 'desconhecido'}\nTelefone: ${appointment.client_phone}\nHora: ${formatPtDateTime(appointment.appointment_at)}`
    );
  } catch (e) {
    console.error('[/api/appointments/confirm] WhatsApp failed:', e);
  }

  return NextResponse.json({ success: true });
}
