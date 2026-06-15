import { AgentDispatchClient, RoomServiceClient, SipClient } from 'livekit-server-sdk';

function httpUrl(): string {
  return process.env.LIVEKIT_URL!.replace('wss://', 'https://');
}

function creds() {
  return [httpUrl(), process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!] as const;
}

export type OutboundCallParams = {
  appointmentId: string;
  calendarEventId: string;
  clientName: string;
  clientPhone: string;
  appointmentAt: string;
  businessType: string;
};

export type OutboundCallResult = { ok: true } | { ok: false; reason: string };

/** Creates a room, dispatches the voice agent into it with the appointment
 * details as job metadata, and dials the client's phone number into the
 * room via the LiveKit outbound SIP trunk. The agent reads the metadata
 * (`callType: "confirmation"`) to switch to the confirmation prompt/tools. */
export async function triggerOutboundCall(params: OutboundCallParams): Promise<OutboundCallResult> {
  const trunkId = process.env.OUTBOUND_TRUNK_ID;
  if (!trunkId) {
    return { ok: false, reason: 'OUTBOUND_TRUNK_ID não configurado' };
  }

  const roomName = `outbound-${params.appointmentId}`;
  const [host, apiKey, apiSecret] = creds();

  const roomSvc = new RoomServiceClient(host, apiKey, apiSecret);
  await roomSvc.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 2 });

  const dispatchSvc = new AgentDispatchClient(host, apiKey, apiSecret);
  await dispatchSvc.createDispatch(roomName, 'ana-agent', {
    metadata: JSON.stringify({
      callType: 'confirmation',
      appointmentId: params.appointmentId,
      calendarEventId: params.calendarEventId,
      clientName: params.clientName,
      appointmentAt: params.appointmentAt,
      businessType: params.businessType,
    }),
  });

  const sipClient = new SipClient(host, apiKey, apiSecret);
  try {
    await sipClient.createSipParticipant(trunkId, params.clientPhone, roomName, {
      participantIdentity: `client-${params.appointmentId}`,
      displayName: process.env.TRANSFER_CALLER_ID_NAME ?? '24/7 Voice Agent - Demo',
      waitUntilAnswered: true,
      ringingTimeout: Number(process.env.TRANSFER_RING_TIMEOUT_S ?? 20),
      playDialtone: true,
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'erro desconhecido no SIP dial' };
  }

  return { ok: true };
}
