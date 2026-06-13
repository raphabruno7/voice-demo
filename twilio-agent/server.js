import { WebSocketServer } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = readFileSync(join(__dirname, "system-prompt.txt"), "utf8");
const PORT = process.env.PORT || 8080;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
      safeSend(ws, { type: "text", token: "Olá, fala a Ana. Como te posso ajudar?", last: true });
      return;
    }

    if (msg.type === "prompt") {
      const userText = msg.voicePrompt ?? "";
      if (!userText) return;
      history.push({ role: "user", content: userText });

      try {
        const stream = await anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: history,
        });

        let full = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            full += event.delta.text;
            safeSend(ws, { type: "text", token: event.delta.text, last: false });
          }
        }
        safeSend(ws, { type: "text", token: "", last: true });
        history.push({ role: "assistant", content: full });
      } catch (e) {
        console.error("[twilio-agent] LLM error:", e);
        safeSend(ws, { type: "text", token: "Desculpa, tive um problema técnico.", last: true });
      }
    }
  });

  ws.on("error", (err) => console.error("[twilio-agent] ws error:", err));
  ws.on("close", () => console.log("[twilio-agent] connection closed"));
});
