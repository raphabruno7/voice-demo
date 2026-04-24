export type VapiEvent =
  | { message: { type: "call-started"; call: { id: string; startedAt: string } } }
  | {
      message: {
        type: "end-of-call-report";
        call: { id: string; startedAt: string; endedAt: string };
        durationSeconds: number;
        transcript: string;
        summary: string;
      };
    };

export function detectLanguage(transcript: string): "pt" | "en" | "unknown" {
  if (!transcript) return "unknown";
  const ptWords = /\b(olá|obrigado|sim|não|como|você|para|por favor|bom|boa|dia|tarde|noite|posso|quero|tenho)\b/gi;
  const enWords = /\b(hello|thank|yes|no|how|you|for|please|good|can|want|have|the|and|that)\b/gi;
  const ptMatches = (transcript.match(ptWords) ?? []).length;
  const enMatches = (transcript.match(enWords) ?? []).length;
  if (ptMatches === 0 && enMatches === 0) return "unknown";
  return ptMatches >= enMatches ? "pt" : "en";
}
