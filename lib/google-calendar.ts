import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

export async function createEvent({
  callerName,
  startTime,
}: {
  callerName: string;
  startTime: string;
}) {
  const calendar = google.calendar({ version: 'v3', auth });
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: {
      summary: `Demo — ${callerName}`,
      description: 'Booked via Ana voice AI agent (voice-demo)',
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Lisbon' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Lisbon' },
    },
  });

  return {
    eventId: res.data.id!,
    htmlLink: res.data.htmlLink!,
    startTime: res.data.start?.dateTime ?? startTime,
  };
}
