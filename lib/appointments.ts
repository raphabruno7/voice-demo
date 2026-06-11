import { getSupabaseAdmin } from './supabase';

export type OutboundAppointment = {
  id: string;
  calendar_event_id: string;
  client_name: string | null;
  client_phone: string | null;
  appointment_at: string;
  business_type: string | null;
  reminder_status: string;
  reminder_attempts: number;
};

export async function getOutboundAppointment(appointmentId: string): Promise<OutboundAppointment | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('outbound_appointments')
    .select('*')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OutboundAppointment;
}
