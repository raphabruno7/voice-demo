import { NextRequest, NextResponse } from 'next/server';
import { getOutboundAppointment } from '@/lib/appointments';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cancelEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';
import { formatPtDateTime } from '@/lib/format';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appointmentId, reason } = (await req.json()) as { appointmentId?: string; reason?: string };
  if (!appointmentId) {
    return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 200 });
  }

  const appointment = await getOutboundAppointment(appointmentId);
  if (!appointment) {
    return NextResponse.json({ success: false, error: 'appointment not found' }, { status: 200 });
  }

  try {
    await cancelEvent(appointment.calendar_event_id);
  } catch (e) {
    console.error('[/api/appointments/cancel] cancelEvent failed:', e);
    return NextResponse.json({ success: false, error: 'failed to cancel calendar event' }, { status: 200 });
  }

  await getSupabaseAdmin()
    .from('outbound_appointments')
    .update({
      reminder_status: 'cancelled',
      outcome_notes: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  try {
    await sendWhatsApp(
      `❌ Marcação cancelada via agente de voz\n\nCliente: ${appointment.client_name || 'desconhecido'}\nTelefone: ${appointment.client_phone}\nEra: ${formatPtDateTime(appointment.appointment_at)}\nMotivo: ${reason || 'não especificado'}`
    );
  } catch (e) {
    console.error('[/api/appointments/cancel] WhatsApp failed:', e);
  }

  return NextResponse.json({ success: true });
}
