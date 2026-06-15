import { NextRequest, NextResponse } from 'next/server';
import { getOutboundAppointment } from '@/lib/appointments';
import { getSupabaseAdmin } from '@/lib/supabase';
import { updateEventTime } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';
import { formatPtDateTime } from '@/lib/format';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appointmentId, newStartTime } = (await req.json()) as {
    appointmentId?: string;
    newStartTime?: string;
  };
  if (!appointmentId || !newStartTime) {
    return NextResponse.json(
      { success: false, error: 'appointmentId and newStartTime required' },
      { status: 200 }
    );
  }

  const appointment = await getOutboundAppointment(appointmentId);
  if (!appointment) {
    return NextResponse.json({ success: false, error: 'appointment not found' }, { status: 200 });
  }

  try {
    await updateEventTime(appointment.calendar_event_id, newStartTime);
  } catch (e) {
    console.error('[/api/appointments/reschedule] updateEventTime failed:', e);
    return NextResponse.json({ success: false, error: 'failed to update calendar' }, { status: 200 });
  }

  await getSupabaseAdmin()
    .from('outbound_appointments')
    .update({
      appointment_at: newStartTime,
      reminder_status: 'rescheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  const meetingTime = formatPtDateTime(newStartTime);

  try {
    await sendWhatsApp(
      `🔄 Marcação remarcada via agente de voz\n\nCliente: ${appointment.client_name || 'desconhecido'}\nTelefone: ${appointment.client_phone}\nNova hora: ${meetingTime}`
    );
  } catch (e) {
    console.error('[/api/appointments/reschedule] WhatsApp failed:', e);
  }

  return NextResponse.json({ success: true, meetingTime });
}
