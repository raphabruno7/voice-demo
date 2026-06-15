"""
SIP Trunk setup for LiveKit — run ONCE when number is ready.

Usage:
    PHONE_NUMBER=+351XXXXXXXXX \
    SIP_USER=<didww-sip-username> \
    SIP_PASS=<didww-sip-password> \
    DIDWW_OUTBOUND_ADDRESS=<didww-outbound-sip-host> \
    LIVEKIT_URL=wss://voice-agent-hfi9y0b7.livekit.cloud \
    LIVEKIT_API_KEY=... \
    LIVEKIT_API_SECRET=... \
    ./venv/bin/python setup_sip.py

After this runs, set OUTBOUND_TRUNK_ID (printed below) on the livekit-agent
deploy to enable attended ("warm") transfer with voicemail/no-answer detection
in agent.py — without it, transfers fall back to a blind SIP REFER.
"""
import asyncio
import os
from livekit import api

LIVEKIT_URL = os.environ["LIVEKIT_URL"].replace("wss://", "https://")
API_KEY = os.environ["LIVEKIT_API_KEY"]
API_SECRET = os.environ["LIVEKIT_API_SECRET"]
PHONE_NUMBER = os.environ["PHONE_NUMBER"]       # e.g. +351301234567
SIP_USER = os.environ.get("SIP_USER", "")       # DIDWW SIP username (optional)
SIP_PASS = os.environ.get("SIP_PASS", "")       # DIDWW SIP password (optional)

# DIDWW outbound SIP host — from DIDWW dashboard "Origination" / outbound trunk
# config. Required for the outbound trunk (warm transfer); leave empty to skip
# outbound trunk creation.
DIDWW_OUTBOUND_ADDRESS = os.environ.get("DIDWW_OUTBOUND_ADDRESS", "")

# DIDWW signaling IPs (allowlist)
DIDWW_IPS = [
    "46.19.209.14/32",
    "46.19.210.14/32",
    "46.19.212.14/32",
    "46.19.213.14/32",
    "46.19.214.14/32",
    "46.19.215.14/32",
    "185.238.173.14/32",
]


async def main():
    lkapi = api.LiveKitAPI(LIVEKIT_URL, API_KEY, API_SECRET)

    # 1 — Create inbound SIP trunk
    trunk_req = api.CreateSIPInboundTrunkRequest(
        trunk=api.SIPInboundTrunkInfo(
            name="DIDWW +351",
            numbers=[PHONE_NUMBER],
            auth_username=SIP_USER or None,
            auth_password=SIP_PASS or None,
            allowed_addresses=DIDWW_IPS,
        )
    )
    trunk = await lkapi.sip.create_sip_inbound_trunk(trunk_req)
    trunk_id = trunk.sip_trunk_id
    print(f"✅ Inbound trunk created: {trunk_id}")

    # 2 — Create dispatch rule: new room per call → dispatch ana-agent
    dispatch_req = api.CreateSIPDispatchRuleRequest(
        dispatch_rule=api.SIPDispatchRuleInfo(
            name="Voice agent inbound",
            trunk_ids=[trunk_id],
            rule=api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                    room_prefix="call-"
                )
            ),
            room_config=api.RoomConfiguration(
                agents=[
                    api.RoomAgentDispatch(
                        agent_name="ana-agent",
                    )
                ]
            ),
        )
    )
    dispatch = await lkapi.sip.create_sip_dispatch_rule(dispatch_req)
    print(f"✅ Dispatch rule created: {dispatch.sip_dispatch_rule_id}")

    # 3 — Create outbound trunk (used for attended/"warm" transfer to Raphael)
    outbound_trunk_id = None
    if DIDWW_OUTBOUND_ADDRESS:
        outbound_req = api.CreateSIPOutboundTrunkRequest(
            trunk=api.SIPOutboundTrunkInfo(
                name="DIDWW +351 outbound",
                address=DIDWW_OUTBOUND_ADDRESS,
                numbers=[PHONE_NUMBER],
                auth_username=SIP_USER or None,
                auth_password=SIP_PASS or None,
            )
        )
        outbound_trunk = await lkapi.sip.create_sip_outbound_trunk(outbound_req)
        outbound_trunk_id = outbound_trunk.sip_trunk_id
        print(f"✅ Outbound trunk created: {outbound_trunk_id}")
    else:
        print("⏭️  Skipped outbound trunk (DIDWW_OUTBOUND_ADDRESS not set) — "
              "warm transfer will fall back to blind SIP REFER.")

    print()
    print("=== DIDWW SIP settings ===")
    print(f"SIP URI:  sip.livekit.cloud  (port 5060/5061)")
    print(f"Domain:   voice-agent-hfi9y0b7.sip.livekit.cloud")
    print(f"Trunk ID: {trunk_id}")
    print(f"Number:   {PHONE_NUMBER}")
    if outbound_trunk_id:
        print(f"Outbound Trunk ID: {outbound_trunk_id}")
        print(f"  -> set OUTBOUND_TRUNK_ID={outbound_trunk_id} on livekit-agent")
    print()
    print("=== Branded caller ID (CNAM) ===")
    print("LiveKit sets the SIP From display-name to TRANSFER_CALLER_ID_NAME")
    print("(default '24/7 Voice Agent - Demo'), but whether Raphael's carrier shows it")
    print("depends on CNAM passthrough. For a registered name (e.g. '24/7 Voice Agent - "
          "Raphael Bruno'), register CNAM for the +351 number in the DIDWW "
          "dashboard under Numbers > CNAM / Caller ID.")

    await lkapi.aclose()


if __name__ == "__main__":
    asyncio.run(main())
