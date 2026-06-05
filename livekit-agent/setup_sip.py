"""
SIP Trunk setup for LiveKit — run ONCE when number is ready.

Usage:
    PHONE_NUMBER=+351XXXXXXXXX \
    SIP_USER=<didww-sip-username> \
    SIP_PASS=<didww-sip-password> \
    LIVEKIT_URL=wss://voice-agent-hfi9y0b7.livekit.cloud \
    LIVEKIT_API_KEY=... \
    LIVEKIT_API_SECRET=... \
    ./venv/bin/python setup_sip.py
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
            name="Ana inbound",
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

    print()
    print("=== DIDWW SIP settings ===")
    print(f"SIP URI:  sip.livekit.cloud  (port 5060/5061)")
    print(f"Domain:   voice-agent-hfi9y0b7.sip.livekit.cloud")
    print(f"Trunk ID: {trunk_id}")
    print(f"Number:   {PHONE_NUMBER}")

    await lkapi.aclose()


if __name__ == "__main__":
    asyncio.run(main())
