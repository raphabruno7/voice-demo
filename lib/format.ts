/** Formats an ISO datetime as a pt-PT phrase, e.g. "terça-feira, 16 de junho, 15:00". */
export function formatPtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  });
}
