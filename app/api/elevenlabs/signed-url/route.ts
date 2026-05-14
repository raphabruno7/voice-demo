import { NextResponse } from "next/server";

export async function POST() {
  const agentId = process.env.ELEVENLABS_AGENT_ID!;
  const apiKey = process.env.ELEVENLABS_API_KEY!;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to get signed URL" }, { status: 500 });
  }

  const { signed_url } = await res.json();
  return NextResponse.json({ signedUrl: signed_url });
}
