import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { phoneNumber } = await req.json();

  if (!phoneNumber || typeof phoneNumber !== "string") {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: phoneNumber },
      assistantOverrides: {
        model: { provider: "groq", model: "llama-3.3-70b-versatile", temperature: 0.3, maxTokens: 150 },
        firstMessage: "Olá, sou um agente de voz — uma demonstração real de automação por IA criada por Raphael Bruno. Como posso ajudar?",
        firstMessageMode: "assistant-speaks-first",
        maxDurationSeconds: 240,
        backgroundSound: "off",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error }, { status: response.status });
  }

  return NextResponse.json({ ok: true });
}
