import { WebSocketServer } from "ws";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8");
const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;

const wss = new WebSocketServer({ port: PORT });
console.log(`[twilio-agent] ConversationRelay WS listening on :${PORT}`);

function safeSend(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
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
        const res = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: history,
            generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
          }),
        });

        let full = "";
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
              const token = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (token) {
                full += token;
                safeSend(ws, { type: "text", token, last: false });
              }
            } catch {}
          }
        }

        safeSend(ws, { type: "text", token: "", last: true });
        history.push({ role: "model", parts: [{ text: full }] });
      } catch (e) {
        console.error("[twilio-agent] LLM error:", e);
        safeSend(ws, { type: "text", token: "Desculpa, tive um problema técnico.", last: true });
      }
    }
  });

  ws.on("error", (err) => console.error("[twilio-agent] ws error:", err));
  ws.on("close", () => console.log("[twilio-agent] connection closed"));
});
