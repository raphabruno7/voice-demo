import { createEvent } from '@/lib/google-calendar';
import { sendWhatsApp } from '@/lib/whatsapp';

export type BookMeetingArgs = {
  callerName: string;
  callerPhone: string;
  startTime: string;
};

export type BookMeetingResult = {
  success: boolean;
  meetingTime?: string;
  error?: string;
};

export async function bookMeeting(args: BookMeetingArgs): Promise<BookMeetingResult> {
  try {
    await createEvent(args);
    const meetingTime = new Date(args.startTime).toLocaleString('pt-PT', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon',
    });

    // Await so the serverless fn doesn't terminate mid-flight; ~500ms cost.
    try {
      await sendWhatsApp(
        `📅 Novo agendamento via agente de voz\n\nNome: ${args.callerName}\nTelefone: ${args.callerPhone}\nHora: ${meetingTime}`
      );
    } catch (e) {
      console.error('[bookMeeting] WhatsApp failed:', e);
    }

    return { success: true, meetingTime };
  } catch (err) {
    console.error('[bookMeeting] createEvent failed:', err);
    return { success: false, error: 'Failed to create calendar event' };
  }
}
