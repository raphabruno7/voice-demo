import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8");
const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error("[twilio-agent] GEMINI_API_KEY not set — exiting"); process.exit(1); }
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
const CALENDAR_ENDPOINT = process.env.CALENDAR_ENDPOINT;
const TWILIO_AGENT_SECRET = process.env.TWILIO_AGENT_SECRET;

const TOOLS = [{
  functionDeclarations: [{
    name: "book_meeting",
    description: "Marca uma reunião com o Raphael Bruno no Google Calendar e envia confirmação por WhatsApp.",
    parameters: {
      type: "OBJECT",
      properties: {
        callerName:  { type: "STRING", description: "Nome completo do utilizador" },
        callerPhone: { type: "STRING", description: "Número de telefone com indicativo, ex: +351912345678" },
        startTime:   { type: "STRING", description: "Data e hora em ISO 8601, ex: 2026-06-26T10:00:00" },
      },
      required: ["callerName", "callerPhone", "startTime"],
    },
  }],
}];

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, () => console.log(`[twilio-agent] HTTP+WS listening on :${PORT}`));

function safeSend(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function callBookMeeting(args) {
  if (!CALENDAR_ENDPOINT || !TWILIO_AGENT_SECRET) {
    return "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  }
  try {
    const res = await fetch(CALENDAR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-twilio-agent-secret": TWILIO_AGENT_SECRET,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    return data.result ?? "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  } catch (e) {
    console.error("[twilio-agent] book_meeting error:", e);
    return "Não consegui criar o evento agora. O Raphael contacta-te directamente.";
  }
}

async function streamGemini(history, ws) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history,
      tools: TOOLS,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
    }),
  });

  let full = "";
  let functionCall = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const chunk = JSON.parse(json);
        const part = chunk.candidates?.[0]?.content?.parts?.[0];
        if (!part) continue;

        if (part.functionCall) {
          functionCall = part.functionCall;
        } else if (part.text) {
          full += part.text;
          safeSend(ws, { type: "text", token: part.text, last: false });
        }
      } catch {}
    }
  }

  return { full, functionCall };
}

wss.on("connection", (ws) => {
  const history = [];

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "setup") {
      safeSend(ws, {
        type: "text",
        token: "Olá! Sou um agente de voz com inteligência artificial, uma demonstração ao vivo criada pelo Raphael Bruno. Como posso ajudar?",
        last: true,
      });
      return;
    }

    if (msg.type === "prompt") {
      const userText = msg.voicePrompt ?? "";
      if (!userText) return;
      history.push({ role: "user", parts: [{ text: userText }] });

      try {
        const { full, functionCall } = await streamGemini(history, ws);

        if (functionCall) {
          if (full) safeSend(ws, { type: "text", token: "", last: true });
          safeSend(ws, { type: "text", token: "Um momento, vou marcar já.", last: true });

          // Adicionar functionCall ao histórico
          history.push({ role: "model", parts: [{ functionCall }] });

          // Executar o booking
          const result = await callBookMeeting(functionCall.args ?? {});

          // Adicionar functionResponse ao histórico
          history.push({
            role: "user",
            parts: [{ functionResponse: { name: functionCall.name, response: { result } } }],
          });

          // Obter confirmação do Gemini
          const { full: confirmFull } = await streamGemini(history, ws);
          history.push({ role: "model", parts: [{ text: confirmFull }] });
          safeSend(ws, { type: "text", token: "", last: true });
        } else {
          safeSend(ws, { type: "text", token: "", last: true });
          history.push({ role: "model", parts: [{ text: full }] });
        }
      } catch (e) {
        console.error("[twilio-agent] LLM error:", e);
        safeSend(ws, { type: "text", token: "Desculpa, tive um problema técnico.", last: true });
      }
    }
  });

  ws.on("error", (err) => console.error("[twilio-agent] ws error:", err));
  ws.on("close", () => console.log("[twilio-agent] connection closed"));
});
