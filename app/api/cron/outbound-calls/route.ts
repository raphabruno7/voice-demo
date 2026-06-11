import { NextRequest, NextResponse } from 'next/server';
import { listUpcomingEvents } from '@/lib/google-calendar';
import { triggerOutboundCall } from '@/lib/livekit-outbound';
import { sendWhatsApp } from '@/lib/whatsapp';
import { getSupabaseAdmin } from '@/lib/supabase';

const REMINDER_WINDOW_START_H = Number(process.env.REMINDER_WINDOW_START_H ?? 20);
const REMINDER_WINDOW_END_H = Number(process.env.REMINDER_WINDOW_END_H ?? 28);
const MAX_REMINDER_ATTEMPTS = Number(process.env.MAX_REMINDER_ATTEMPTS ?? 1);
const MAX_OUTBOUND_CALLS_PER_RUN = Number(process.env.MAX_OUTBOUND_CALLS_PER_RUN ?? 3);
const CALL_HOURS_START = Number(process.env.CALL_HOURS_START ?? 9);
const CALL_HOURS_END = Number(process.env.CALL_HOURS_END ?? 19);

function lisbonHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: 'numeric', hour12: false }).format(date)
  );
}

function isWithinCallingHours(date: Date): boolean {
  const hour = lisbonHour(date);
  return hour >= CALL_HOURS_START && hour < CALL_HOURS_END;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  if (!isWithinCallingHours(now)) {
    return NextResponse.json({ skipped: 'outside calling hours', lisbonHour: lisbonHour(now) });
  }

  const timeMin = new Date(now.getTime() + REMINDER_WINDOW_START_H * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + REMINDER_WINDOW_END_H * 60 * 60 * 1000).toISOString();

  const db = getSupabaseAdmin();
  const events = await listUpcomingEvents({ timeMin, timeMax });

  // Register every appointment in the reminder window so the cron can track
  // and rate-limit it, even if it has no phone (informational only).
  for (const event of events) {
    await db.from('outbound_appointments').upsert(
      {
        calendar_event_id: event.eventId,
        client_name: event.attendeeName,
        client_phone: event.phone || null,
        appointment_at: event.startTime,
        outcome_notes: event.phone ? null : 'sem telefone — não é possível ligar',
      },
      { onConflict: 'calendar_event_id', ignoreDuplicates: true }
    );
  }

  const { data: candidates, error } = await db
    .from('outbound_appointments')
    .select('*')
    .eq('reminder_status', 'pending')
    .not('client_phone', 'is', null)
    .lt('reminder_attempts', MAX_REMINDER_ATTEMPTS)
    .gte('appointment_at', timeMin)
    .lt('appointment_at', timeMax)
    .limit(MAX_OUTBOUND_CALLS_PER_RUN);

  if (error) {
    console.error('[/api/cron/outbound-calls] failed to load candidates:', error);
    return NextResponse.json({ error: 'failed to load candidates' }, { status: 500 });
  }

  const results: Array<{ calendarEventId: string; outcome: string }> = [];

  for (const appointment of candidates ?? []) {
    const result = await triggerOutboundCall({
      appointmentId: appointment.id,
      calendarEventId: appointment.calendar_event_id,
      clientName: appointment.client_name ?? '',
      clientPhone: appointment.client_phone,
      appointmentAt: appointment.appointment_at,
      businessType: appointment.business_type ?? 'marcação',
    });

    const status = result.ok ? 'called' : 'no_answer';
    await db
      .from('outbound_appointments')
      .update({
        reminder_status: status,
        reminder_attempts: appointment.reminder_attempts + 1,
        last_attempt_at: now.toISOString(),
        outcome_notes: result.ok ? null : result.reason,
        updated_at: now.toISOString(),
      })
      .eq('id', appointment.id);

    if (!result.ok) {
      try {
        await sendWhatsApp(
          `📵 Chamada de confirmação falhou\n\nCliente: ${appointment.client_name || 'desconhecido'}\nTelefone: ${appointment.client_phone}\nMarcação: ${appointment.appointment_at}\nMotivo: ${result.reason}\n\nContactar manualmente.`
        );
      } catch (e) {
        console.error('[/api/cron/outbound-calls] WhatsApp notification failed:', e);
      }
    }

    results.push({ calendarEventId: appointment.calendar_event_id, outcome: status });
  }

  return NextResponse.json({ checked: events.length, called: results.length, results });
}
