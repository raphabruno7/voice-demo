import { google } from 'googleapis';

function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

export async function createEvent({
  callerName,
  callerPhone,
  startTime,
}: {
  callerName: string;
  callerPhone?: string;
  startTime: string;
}) {
  const calendar = getCalendarClient();
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const descriptionParts = ['Booked via Ana voice AI agent (voice-demo)'];
  if (callerPhone) descriptionParts.push(`Tel: ${callerPhone}`);

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: {
      summary: `Demo — ${callerName}`,
      description: descriptionParts.join('\n'),
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Lisbon' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Lisbon' },
      extendedProperties: { private: { phone: callerPhone ?? '' } },
    },
  });

  return {
    eventId: res.data.id!,
    htmlLink: res.data.htmlLink!,
    startTime: res.data.start?.dateTime ?? startTime,
  };
}

export type UpcomingEvent = {
  eventId: string;
  summary: string;
  startTime: string;
  attendeeName: string;
  phone: string;
};

/** Lists events starting within [timeMin, timeMax), used by the outbound
 * confirmation-call cron to find appointments that need a reminder call. */
export async function listUpcomingEvents({
  timeMin,
  timeMax,
}: {
  timeMin: string;
  timeMax: string;
}): Promise<UpcomingEvent[]> {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items ?? [])
    .filter((event) => event.id && event.start?.dateTime)
    .map((event) => ({
      eventId: event.id!,
      summary: event.summary ?? '',
      startTime: event.start!.dateTime!,
      attendeeName: (event.summary ?? '').replace(/^Demo — /, ''),
      phone: event.extendedProperties?.private?.phone ?? '',
    }));
}

/** Reschedules an event to a new start time, keeping its original duration. */
export async function updateEventTime(eventId: string, newStartTime: string) {
  const calendar = getCalendarClient();
  const existing = await calendar.events.get({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
  });

  const oldStart = new Date(existing.data.start?.dateTime ?? newStartTime);
  const oldEnd = new Date(existing.data.end?.dateTime ?? newStartTime);
  const durationMs = oldEnd.getTime() - oldStart.getTime();

  const newStart = new Date(newStartTime);
  const newEnd = new Date(newStart.getTime() + durationMs);

  const res = await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
    requestBody: {
      start: { dateTime: newStart.toISOString(), timeZone: 'Europe/Lisbon' },
      end: { dateTime: newEnd.toISOString(), timeZone: 'Europe/Lisbon' },
    },
  });

  return { eventId: res.data.id!, startTime: res.data.start?.dateTime ?? newStartTime };
}

/** Cancels (deletes) an event. */
export async function cancelEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
  });
}
