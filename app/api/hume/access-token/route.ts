import { NextResponse } from "next/server";
import { fetchAccessToken } from "hume";

export const dynamic = "force-dynamic";

export async function POST() {
  const apiKey = process.env.HUME_API_KEY;
  const secretKey = process.env.HUME_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.error("[/api/hume/access-token] missing HUME_API_KEY or HUME_SECRET_KEY");
    return NextResponse.json(
      { error: "Server misconfigured: missing Hume credentials" },
      { status: 500 }
    );
  }

  try {
    const accessToken = await fetchAccessToken({ apiKey, secretKey });
    if (!accessToken) {
      return NextResponse.json({ error: "Empty token from Hume" }, { status: 502 });
    }
    return NextResponse.json({ accessToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/hume/access-token] fetch failed:", msg);
    return NextResponse.json({ error: "Failed to fetch access token", detail: msg }, { status: 502 });
  }
}
