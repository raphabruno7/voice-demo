import { NextRequest, NextResponse } from "next/server";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { randomUUID } from "crypto";
import { NICHE_KEYS } from "@/lib/niches";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const identity = (body.participantName as string | undefined) ?? "caller";
  const roomName = `ana-${randomUUID()}`;

  const httpUrl = process.env.LIVEKIT_URL!.replace("wss://", "https://");
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const leadPhone = body.leadPhone as string | undefined;
  let niche = body.niche as string | undefined;

  // Validate niche (if provided)
  if (niche && !NICHE_KEYS.includes(niche)) {
    niche = undefined;
  }

  const roomSvc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  await roomSvc.createRoom({
    name: roomName,
    emptyTimeout: 300,
    maxParticipants: 2,
    metadata: leadPhone || niche
      ? JSON.stringify({ leadPhone, niche })
      : undefined,
  });

  const dispatchSvc = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
  await dispatchSvc.createDispatch(roomName, "ana-agent");

  const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "10m" });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

  return NextResponse.json({
    token: await at.toJwt(),
    url: process.env.LIVEKIT_URL!,
    roomName,
  });
}
