# Pilot video — "The Missed Call"

**Goal:** Upwork-facing ad. The most universal, sellable pain for EU/US business owners: a missed call is lost revenue. Ana solves it.

- **Format:** vertical 9:16, ~15s (2 × ~8s Veo clips concatenated)
- **Language:** English (Upwork global)
- **Model:** `veo-3.1-fast-generate-preview` (native audio)
- **Umbrella message:** *Every missed call is a lost customer. Ana answers 24/7, books the meeting — live.*

## Clip 1 — "The pain" (~8s)

Empty restaurant after close, phone rings, nobody answers, call missed.

**Veo prompt:**
> Cinematic vertical 9:16 video. Interior of a small cozy European restaurant late at night, just after closing: chairs stacked on tables, warm dim amber lighting, a "Closed" sign on the glass door. On the polished wooden counter a smartphone screen lights up and rings, vibrating against the wood, an incoming call on screen. The camera slowly dollies in toward the ringing phone. Nobody comes to answer it; the ringing continues, lonely and echoing in the empty room. The call ends — the screen shows "Missed Call". Moody, melancholic, shallow depth of field, premium commercial look. Ambient audio: a single phone ringing echoing in a quiet empty restaurant, then silence. Clean white on-screen text at the end: "Every missed call is a lost customer."

**Negative:** cartoon, low quality, distorted, watermark, blurry text, extra fingers, deformed hands

## Clip 2 — "The relief" (~8s)

Same phone, now a glowing AI waveform; Ana answers warmly and books.

**Veo prompt:**
> Cinematic vertical 9:16 video. The same restaurant counter and smartphone, but now the screen glows with a soft blue pulsing voice-assistant waveform. The lighting warms up, hopeful and bright. A friendly, warm female AI voice answers in clear English: "Good evening! Thanks for calling — I can book your table right now." The blue waveform pulses gently in sync with her voice. Confident, modern, premium technology feel, clean and bright. Clean white on-screen text: "Your 24/7 voice agent — answers every call, books the meeting." The shot ends on a clean end-card reading: "A live voice AI agent. Talk to her now."

**Negative:** cartoon, low quality, distorted, watermark, blurry text, robotic monotone voice, extra fingers

## Post
- Concatenate clip1 + clip2 with ffmpeg → `the-missed-call.mp4`
- Optional end-card overlay with `voice-demo-navy.vercel.app` (added in post if Veo text is weak)
