#!/usr/bin/env python3
"""Teste manual do arcus_lookup.py — sem pytest, correr directamente.

Uso:
  ARCUS_SUPABASE_URL=... ARCUS_SUPABASE_KEY=... ./venv/bin/python test_arcus_lookup.py +351912345678
  ARCUS_SUPABASE_URL=... ARCUS_SUPABASE_KEY=... ./venv/bin/python test_arcus_lookup.py --name "Clínica Exemplo"
"""
import asyncio
import sys

from arcus_lookup import build_lead_context, lookup_by_company_name, lookup_by_phone, render_lead_context_block


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    if sys.argv[1] == "--name":
        contact = await lookup_by_company_name(sys.argv[2])
    else:
        contact = await lookup_by_phone(sys.argv[1])

    print("contact:", contact)
    if contact:
        lead_context = build_lead_context(contact)
        print("lead_context:", lead_context)
        print()
        print(render_lead_context_block(lead_context))
    else:
        print("não encontrado")


if __name__ == "__main__":
    asyncio.run(main())
