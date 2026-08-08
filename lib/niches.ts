import nichesData from "../livekit-agent/niches.json" with { type: "json" };

export type Niche = {
  key: string;
  label: string;
  pain_one_liner_pt: string;
  pain_one_liner_en: string;
  ticket_estimated_eur: number;
};

// Transform the JSON structure into a normalized Record<string, Niche>
// The JSON has "peniche_restaurantes": {...}, but we extract the `key` field
// Result: { "restaurantes": {key: "restaurantes", label: "Restaurantes", ...}, ... }
export const NICHES: Record<string, Niche> = Object.values(
  nichesData.niches as Record<string, Omit<Niche, "key"> & { key: string }>
).reduce(
  (acc, niche) => {
    acc[niche.key] = {
      key: niche.key,
      label: niche.label,
      pain_one_liner_pt: niche.pain_one_liner_pt,
      pain_one_liner_en: niche.pain_one_liner_en,
      ticket_estimated_eur: niche.ticket_estimated_eur,
    };
    return acc;
  },
  {} as Record<string, Niche>
);

// Export an array of niche keys sorted alphabetically
export const NICHE_KEYS: string[] = Object.keys(NICHES).sort();

// Active niches for prospection (from prospeccao-ativa/CLAUDE.md)
export const ACTIVE_NICHES: string[] = [
  "restaurantes",
  "clinicas",
  "advocacia",
  "imobiliarias",
  "guest_house",
];
