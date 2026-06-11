"""Lookup e registo de leads no Arcus CRM (Supabase REST), para o agente de voz "Ana"."""
import json
import logging
import os
import re
from pathlib import Path

import httpx

logger = logging.getLogger("ana-agent")

ARCUS_URL = os.environ.get("ARCUS_SUPABASE_URL", "")
ARCUS_KEY = os.environ.get("ARCUS_SUPABASE_KEY", "")
ORG_ID = os.environ.get("ARCUS_ORG_ID", "c4669ad5-e6b2-41ed-9c51-c09dfbec17f9")

NICHES = json.loads(Path(__file__).parent.joinpath("niches.json").read_text())["niches"]


def _headers() -> dict:
    return {
        "apikey": ARCUS_KEY,
        "Authorization": f"Bearer {ARCUS_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def normalize_phone(raw: str) -> str:
    """Normaliza um número para o formato +351XXXXXXXXX (ou +<país>...)."""
    digits = re.sub(r"[^\d+]", "", raw or "")
    if not digits:
        return ""
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


async def lookup_by_phone(phone: str) -> dict | None:
    phone = normalize_phone(phone)
    if not phone:
        return None
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(
            f"{ARCUS_URL}/rest/v1/contacts",
            headers=_headers(),
            params={
                "select": "id,name,phone,tags,notes,stage",
                "phone": f"eq.{phone}",
                "organization_id": f"eq.{ORG_ID}",
                "limit": "1",
            },
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def lookup_by_company_name(name: str) -> dict | None:
    name = (name or "").strip()
    if not name:
        return None
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(
            f"{ARCUS_URL}/rest/v1/contacts",
            headers=_headers(),
            params={
                "select": "id,name,phone,tags,notes,stage",
                "company_name": f"ilike.%{name}%",
                "organization_id": f"eq.{ORG_ID}",
                "limit": "1",
            },
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def update_contact_after_voice_call(contact_id: str, *, extra_tags: list[str] | None = None) -> None:
    if not extra_tags:
        return
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(
            f"{ARCUS_URL}/rest/v1/contacts",
            headers=_headers(),
            params={"select": "tags", "id": f"eq.{contact_id}", "limit": "1"},
        )
        r.raise_for_status()
        rows = r.json()
        current_tags = rows[0].get("tags") or [] if rows else []
        new_tags = list(dict.fromkeys([*current_tags, *extra_tags]))

        r = await client.patch(
            f"{ARCUS_URL}/rest/v1/contacts",
            headers=_headers(),
            params={"id": f"eq.{contact_id}"},
            json={"tags": new_tags},
        )
        r.raise_for_status()


async def log_voice_interaction(contact_id: str, *, title: str, description: str, outcome_type: str = "voice_demo") -> None:
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(
            f"{ARCUS_URL}/rest/v1/activities",
            headers=_headers(),
            json={
                "title": title,
                "description": description,
                "type": outcome_type,
                "date": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                "contact_id": contact_id,
                "completed": True,
                "organization_id": ORG_ID,
            },
        )
        r.raise_for_status()


def pain_for_tags(tags: list[str] | None) -> tuple[str | None, str | None]:
    """Devolve (niche_label, pain_one_liner_pt) a partir da primeira tag peniche_* reconhecida."""
    for tag in (tags or []):
        if tag.startswith("peniche_") and tag in NICHES:
            n = NICHES[tag]
            return n["label"], n.get("pain_one_liner_pt")
    return None, None


def build_lead_context(contact: dict) -> dict:
    label, pain = pain_for_tags(contact.get("tags"))
    return {
        "contact_id": contact["id"],
        "name": contact.get("name") or "",
        "niche_label": label,
        "pain": pain,
    }


def render_lead_context_block(lead_context: dict) -> str:
    lines = ["=== CONTEXTO DO LEAD (esta chamada) ==="]
    lines.append(f"Negócio: {lead_context['name']}")
    if lead_context.get("niche_label"):
        lines.append(f"Tipo de negócio: {lead_context['niche_label']}")
    if lead_context.get("pain"):
        lines.append(f"Dor provável: {lead_context['pain']}")
    lines.append("")
    lines.append(
        "INSTRUÇÃO: Personaliza a conversa com base nestes dados — refere o nome do "
        "negócio na saudação e direcciona os exemplos para a dor acima em vez da "
        "qualificação genérica. Se o utilizador contradisser estes dados, confia nele."
    )
    lines.append("=== FIM CONTEXTO DO LEAD ===")
    return "\n".join(lines)


UNIDENTIFIED_LEAD_INSTRUCTIONS = """=== LEAD NÃO IDENTIFICADO ===
Não foi possível identificar automaticamente este negócio pelo número de telefone.
Logo no início da conversa, depois da saudação, pergunta de forma natural:
"Já agora, qual é o nome do teu negócio? Assim já posso adaptar o que te digo."
Quando souberes o nome, chama a tool lookup_lead_by_name com esse nome.
Se a tool devolver dados, usa-os para personalizar a resposta seguinte.
Se não devolver nada, continua em modo genérico, sem mencionar que tentaste procurar.
=== FIM ==="""
