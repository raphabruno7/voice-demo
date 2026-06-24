import { NextResponse, NextRequest } from "next/server";
import { NICHE_KEYS, NICHES } from "@/lib/niches";

export async function GET(req: NextRequest) {
  const agentId = process.env.ELEVENLABS_AGENT_ID!;
  const apiKey = process.env.ELEVENLABS_API_KEY!;

  // Extract niche from query params
  const { searchParams } = new URL(req.url);
  const niche = searchParams.get("niche");

  // Validate niche and build override block if provided
  let nicheOverride = null;
  if (niche && NICHE_KEYS.includes(niche)) {
    const nicheData = NICHES[niche];
    nicheOverride = `[NICHE: sector=${nicheData.label}. Dor: ${nicheData.pain_one_liner_pt}]\n\n`;
  }

  // Build signed URL query params for ElevenLabs API
  const signedUrlParams = new URLSearchParams({
    agent_id: agentId,
    // NOTE: ElevenLabs ConvAI API does not currently support prompt/conversation_config_override
    // in query params or request body. Niche override requires API enhancement on ElevenLabs side.
    // For now, nicheOverride is prepared but not sent — this is a v2 feature.
  });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?${signedUrlParams}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to get signed URL" }, { status: 500 });
  }

  const { signed_url } = await res.json();
  return NextResponse.json({ signedUrl: signed_url, niche, nicheOverride });
}
