export type Language = 'pt' | 'en' | 'es' | 'de' | 'nl' | 'unknown';
export type Intent = 'qualified' | 'booked' | 'objection' | 'no_interest' | 'unknown';

export type VapiEvent =
  | {
      message: {
        type: "call-started";
        call: { id: string; startedAt: string; customer?: { number?: string } };
      };
    }
  | {
      message: {
        type: "end-of-call-report";
        call: { id: string; startedAt: string; endedAt: string };
        durationSeconds: number;
        transcript: string;
        summary: string;
      };
    };

export function detectLanguage(transcript: string): Language {
  if (!transcript) return 'unknown';
  const patterns: Record<string, RegExp> = {
    pt: /\b(olá|obrigado|sim|não|como|você|para|por favor|bom|boa|dia|tarde|noite|posso|quero|tenho)\b/gi,
    en: /\b(hello|thank|yes|no|how|you|for|please|good|can|want|have|the|and|that)\b/gi,
    es: /\b(hola|gracias|sí|cómo|usted|para|por favor|bueno|puedo|quiero|tengo|bien)\b/gi,
    de: /\b(hallo|danke|ja|nein|wie|sie|für|bitte|gut|kann|möchte|habe|haben)\b/gi,
    nl: /\b(hallo|bedankt|ja|nee|hoe|voor|alstublieft|goed|kan|wil|heb|hebben)\b/gi,
  };
  const counts = Object.entries(patterns).map(([lang, re]) => ({
    lang,
    count: (transcript.match(re) ?? []).length,
  }));
  const top = counts.sort((a, b) => b.count - a.count)[0];
  return top.count === 0 ? 'unknown' : (top.lang as Language);
}

export function extractIntent(summary: string): Intent {
  if (!summary) return 'unknown';
  const s = summary.toLowerCase();
  if (s.includes('booked') || s.includes('agendou') || s.includes('appointment') || s.includes('scheduled')) return 'booked';
  if (s.includes('interested') || s.includes('interessado') || s.includes('qualif') || s.includes('wants to know more')) return 'qualified';
  if (s.includes('not interested') || s.includes('não tem interesse') || s.includes('no interest')) return 'no_interest';
  if (s.includes('objection') || s.includes('objeção') || s.includes('already have') || s.includes('já tem')) return 'objection';
  return 'unknown';
}
