import { NextResponse } from "next/server";
import { fetchAccessToken } from "hume";

export async function POST() {
  const accessToken = await fetchAccessToken({
    apiKey: process.env.HUME_API_KEY!,
    secretKey: process.env.HUME_SECRET_KEY!,
  });

  if (!accessToken) {
    return NextResponse.json({ error: "Failed to fetch access token" }, { status: 500 });
  }

  return NextResponse.json({ accessToken });
}
