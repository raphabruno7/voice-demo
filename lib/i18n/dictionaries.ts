import type { Lang } from "./lang";

export type Dict = {
  nav: {
    portfolio: string;
    hume: string;
    livekit: string;
    elevenlabs: string;
    vapi: string;
    retell: string;
    twilio: string;
    /** Code of the *other* language, shown on the toggle button. */
    langToggleLabel: string;
  };
  gallery: {
    badge: string;
    title: string;
    titleHighlight: string;
    introBefore: string;
    introAfter: string;
    cta: string;
    stacks: {
      hume: { badge: string; title: string; description: string; powered: string };
      livekit: { badge: string; title: string; description: string; powered: string };
      elevenlabs: { badge: string; title: string; description: string; powered: string };
      vapi: { badge: string; title: string; description: string; powered: string };
      retell: { badge: string; title: string; description: string; powered: string };
      twilio: { badge: string; title: string; description: string; powered: string };
    };
  };
  hume: {
    badge: string;
    title: string;
    titleHighlight: string;
    descBefore: string;
    descBold: string;
    descMiddle: string;
    descEnd: string;
    powered: string;
    back: string;
  };
  livekit: {
    badge: string;
    title: string;
    titleHighlight: string;
    descBefore: string;
    descBold: string;
    descAfter: string;
    powered: string;
    back: string;
  };
  elevenlabs: {
    badge: string;
    title: string;
    titleHighlight: string;
    descBefore: string;
    descBold: string;
    descAfter: string;
    powered: string;
    back: string;
  };
  vapi: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
  };
  retell: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
  };
  twilio: {
    badge: string; title: string; titleHighlight: string;
    descBefore: string; descBold: string; descAfter: string;
    powered: string; back: string;
    phoneSoon: string; phoneLabel: string;
  };
  widgets: {
    common: {
      connecting: string;
      endCall: string;
      you: string;
      agentName: string;
    };
    hume: {
      callButton: string;
      requestingMic: string;
      disconnecting: string;
      retry: string;
      speaking: string;
      listening: string;
      errors: {
        noMicSupport: string;
        micDenied: string;
        noMic: string;
        micInUse: string;
        micAccessFailed: string;
        noToken: string;
        connectionError: string;
        connectFailedPrefix: string;
        unknownError: string;
        genericError: string;
      };
    };
    livekit: {
      callButton: string;
      statusListening: string;
      statusThinking: string;
      statusSpeaking: string;
    };
    elevenlabs: {
      callButton: string;
      ending: string;
      listening: string;
      inputPlaceholder: string;
      inputPlaceholderDisabled: string;
      send: string;
    };
    vapi: { callButton: string; ending: string; listening: string; unavailable: string };
    retell: { callButton: string; ending: string; listening: string; unavailable: string };
    twilio: { callButton: string; ending: string; listening: string; unavailable: string };
    callMe: {
      heading: string;
      description: string;
      placeholder: string;
      button: string;
      calling: string;
      success: string;
      error: string;
    };
    qrCode: {
      caption: string;
    };
    phoneNumber: {
      copy: string;
      copied: string;
    };
    callStats: {
      callsReceived: string;
      languages: string;
      avgDuration: string;
      qualifiedLeads: string;
      appointmentsBooked: string;
    };
  };
};

const pt: Dict = {
  nav: {
    portfolio: "Portfólio",
    hume: "Hume EVI",
    livekit: "Gemini Live",
    elevenlabs: "ElevenLabs",
    vapi: "Vapi",
    retell: "Retell",
    twilio: "Twilio",
    langToggleLabel: "EN",
  },
  gallery: {
    badge: "Portfólio · Voice AI Stacks",
    title: "Stacks de Voice AI",
    titleHighlight: "prontos a usar",
    introBefore: "Cada stack abaixo é uma demo a funcionar, construída por",
    introAfter: ". Escolhe a combinação que se encaixa no teu caso de uso.",
    cta: "Experimentar →",
    stacks: {
      hume: {
        badge: "Live Demo · Disponível Agora",
        title: "Hume EVI 4-mini",
        description: "Voz nativa pt-PT, prosódia adaptativa, end-to-end.",
        powered: "Hume EVI 4-mini · Claude Sonnet 4.5",
      },
      livekit: {
        badge: "Teste · Gemini Live",
        title: "Gemini Live via LiveKit",
        description: "Modelo de áudio nativo, multilíngue, candidato a telefone.",
        powered: "Gemini 2.0 Flash · LiveKit · Ana pt-PT",
      },
      elevenlabs: {
        badge: "Teste · ElevenLabs ConvAI",
        title: "ElevenLabs Conversational AI",
        description: "Pipeline STT+LLM+TTS, voz pt-PT, ecossistema ElevenLabs.",
        powered: "ElevenLabs ConvAI · Voz pt-PT",
      },
      vapi: {
        badge: "Pipeline · Vapi",
        title: "Vapi",
        description: "Orquestrador de voz no browser — Claude a pensar, voz portuguesa da ElevenLabs a falar.",
        powered: "Vapi · Claude Sonnet 4 · ElevenLabs",
      },
      retell: {
        badge: "Pipeline · Retell",
        title: "Retell AI",
        description: "Outro orquestrador de pipeline no browser, para comparar fluxo e latência.",
        powered: "Retell · Gemini · ElevenLabs",
      },
      twilio: {
        badge: "Telefonia · Twilio",
        title: "Twilio",
        description: "ConversationRelay nativo — a Ana atende e liga por telefone a sério.",
        powered: "Twilio ConversationRelay · Claude · ElevenLabs",
      },
    },
  },
  hume: {
    badge: "Demo em Direto · Disponível Agora",
    title: "Fala com um Agente de IA",
    titleHighlight: "ao vivo, agora mesmo",
    descBefore: "Liga para o número abaixo e conversa com",
    descBold: "Ana",
    descMiddle:
      ", um agente de voz IA bilingue (PT/EN). Uma demo real de automação por IA construída por",
    descEnd: ".",
    powered: "Tecnologia: Hume EVI 4-mini · Claude Sonnet 4.5",
    back: "← Portfólio",
  },
  livekit: {
    badge: "Teste · Gemini Live",
    title: "Gemini Live",
    titleHighlight: "via LiveKit",
    descBefore: "Agente de voz com",
    descBold: "Google Gemini Live",
    descAfter:
      "— teste de qualidade de voz e latência em browser, antes de ligar ao telefone.",
    powered: "Tecnologia: Gemini 2.0 Flash · LiveKit · Ana pt-PT",
    back: "← Portfólio",
  },
  elevenlabs: {
    badge: "Teste · ElevenLabs ConvAI",
    title: "ElevenLabs",
    titleHighlight: "Conversational AI",
    descBefore: "Agente de voz com",
    descBold: "ElevenLabs Conversational AI",
    descAfter:
      "— pipeline STT+LLM+TTS com voz nativa pt-PT, ideal para quem já usa o ecossistema ElevenLabs.",
    powered: "Tecnologia: ElevenLabs ConvAI · Voz pt-PT",
    back: "← Portfólio",
  },
  vapi: {
    badge: "Pipeline · Vapi", title: "Vapi", titleHighlight: "Orquestrador de Voz",
    descBefore: "Esta demo usa o", descBold: "Vapi", descAfter: "a orquestrar Claude e voz portuguesa em tempo real.",
    powered: "Vapi · Claude Sonnet 4 · ElevenLabs (voz Marta, pt-PT)", back: "← Portfólio",
  },
  retell: {
    badge: "Pipeline · Retell", title: "Retell AI", titleHighlight: "Pipeline de Voz",
    descBefore: "Esta demo usa o", descBold: "Retell AI", descAfter: "para comparar outro orquestrador de pipeline.",
    powered: "Retell · Gemini · ElevenLabs (voz Marta, pt-PT)", back: "← Portfólio",
  },
  twilio: {
    badge: "Telefonia · Twilio", title: "Twilio", titleHighlight: "ConversationRelay",
    descBefore: "Esta demo usa o", descBold: "Twilio ConversationRelay", descAfter: "para chamadas de telefone reais.",
    powered: "Twilio ConversationRelay · Claude · ElevenLabs", back: "← Portfólio",
    phoneSoon: "Número em breve", phoneLabel: "Ou liga para:",
  },
  widgets: {
    common: {
      connecting: "A ligar…",
      endCall: "Terminar chamada",
      you: "Tu",
      agentName: "Ana",
    },
    hume: {
      callButton: "Falar com a Ana",
      requestingMic: "A pedir microfone…",
      disconnecting: "A desligar…",
      retry: "Tentar novamente",
      speaking: "Ana está a falar…",
      listening: "À escuta…",
      errors: {
        noMicSupport: "Browser sem suporte a microfone",
        micDenied: "Permissão de microfone negada",
        noMic: "Nenhum microfone encontrado",
        micInUse: "Microfone em uso por outra aplicação",
        micAccessFailed: "Falha a aceder ao microfone",
        noToken: "Não foi possível obter token de acesso",
        connectionError: "Erro de conexão",
        connectFailedPrefix: "Falha a conectar: ",
        unknownError: "Erro desconhecido",
        genericError: "Erro",
      },
    },
    livekit: {
      callButton: "Falar com a Ana — Gemini Live",
      statusListening: "A ouvir…",
      statusThinking: "A processar…",
      statusSpeaking: "A falar…",
    },
    elevenlabs: {
      callButton: "Falar com a Ana — grátis, agora",
      ending: "A terminar…",
      listening: "A Ana está a ouvir…",
      inputPlaceholder: "Escreve uma mensagem…",
      inputPlaceholderDisabled: "Liga primeiro para escrever à Ana",
      send: "Enviar",
    },
    vapi: { callButton: "Falar com a Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
    retell: { callButton: "Falar com a Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
    twilio: { callButton: "Ligar à Ana", ending: "A terminar…", listening: "A Ana está a ouvir…", unavailable: "Indisponível — em breve" },
    callMe: {
      heading: "Preferes receber a chamada?",
      description: "Indica o teu número e a Ana liga-te em segundos.",
      placeholder: "+351 912 345 678",
      button: "Liga-me",
      calling: "A ligar...",
      success: "A Ana está a ligar-te agora!",
      error: "Não foi possível iniciar a chamada. Tenta novamente.",
    },
    qrCode: {
      caption: "Aponta a câmara para ligar",
    },
    phoneNumber: {
      copy: "Copiar número",
      copied: "Copiado!",
    },
    callStats: {
      callsReceived: "chamadas recebidas",
      languages: "idiomas",
      avgDuration: "duração média",
      qualifiedLeads: "leads qualificados",
      appointmentsBooked: "reuniões marcadas",
    },
  },
};

const en: Dict = {
  nav: {
    portfolio: "Portfolio",
    hume: "Hume EVI",
    livekit: "Gemini Live",
    elevenlabs: "ElevenLabs",
    vapi: "Vapi",
    retell: "Retell",
    twilio: "Twilio",
    langToggleLabel: "PT",
  },
  gallery: {
    badge: "Portfolio · Voice AI Stacks",
    title: "Voice AI Stacks",
    titleHighlight: "ready to use",
    introBefore: "Each stack below is a working demo, built by",
    introAfter: ". Pick the combination that fits your use case.",
    cta: "Try it →",
    stacks: {
      hume: {
        badge: "Live Demo · Available Now",
        title: "Hume EVI 4-mini",
        description: "Native pt-PT voice, adaptive prosody, end-to-end.",
        powered: "Hume EVI 4-mini · Claude Sonnet 4.5",
      },
      livekit: {
        badge: "Test · Gemini Live",
        title: "Gemini Live via LiveKit",
        description: "Native audio model, multilingual, phone-line candidate.",
        powered: "Gemini 2.0 Flash · LiveKit · Ana pt-PT",
      },
      elevenlabs: {
        badge: "Test · ElevenLabs ConvAI",
        title: "ElevenLabs Conversational AI",
        description: "STT+LLM+TTS pipeline, pt-PT voice, ElevenLabs ecosystem.",
        powered: "ElevenLabs ConvAI · pt-PT voice",
      },
      vapi: { badge: "Pipeline · Vapi", title: "Vapi", description: "Browser voice orchestrator — Claude thinking, ElevenLabs Portuguese voice speaking.", powered: "Vapi · Claude Sonnet 4 · ElevenLabs" },
      retell: { badge: "Pipeline · Retell", title: "Retell AI", description: "Another browser pipeline orchestrator, to compare flow and latency.", powered: "Retell · Gemini · ElevenLabs" },
      twilio: { badge: "Telephony · Twilio", title: "Twilio", description: "Native ConversationRelay — Ana answers and dials over a real phone line.", powered: "Twilio ConversationRelay · Claude · ElevenLabs" },
    },
  },
  hume: {
    badge: "Live Demo · Available Now",
    title: "Talk to an AI Agent",
    titleHighlight: "live, right now",
    descBefore: "Call the number below and chat with",
    descBold: "Ana",
    descMiddle:
      ", a bilingual AI voice agent (PT / EN). A real-world demo of AI automation built by",
    descEnd: ".",
    powered: "Powered by Hume EVI 4-mini · Claude Sonnet 4.5",
    back: "← Portfolio",
  },
  livekit: {
    badge: "Test · Gemini Live",
    title: "Gemini Live",
    titleHighlight: "via LiveKit",
    descBefore: "Voice agent powered by",
    descBold: "Google Gemini Live",
    descAfter:
      "— test voice quality and latency in the browser, before going live on the phone.",
    powered: "Powered by Gemini 2.0 Flash · LiveKit · Ana pt-PT",
    back: "← Portfolio",
  },
  elevenlabs: {
    badge: "Test · ElevenLabs ConvAI",
    title: "ElevenLabs",
    titleHighlight: "Conversational AI",
    descBefore: "Voice agent powered by",
    descBold: "ElevenLabs Conversational AI",
    descAfter:
      "— an STT+LLM+TTS pipeline with a native pt-PT voice, ideal if you're already in the ElevenLabs ecosystem.",
    powered: "Powered by ElevenLabs ConvAI · pt-PT voice",
    back: "← Portfolio",
  },
  vapi: { badge: "Pipeline · Vapi", title: "Vapi", titleHighlight: "Voice Orchestrator", descBefore: "This demo uses", descBold: "Vapi", descAfter: "to orchestrate Claude and a Portuguese voice in real time.", powered: "Vapi · Claude Sonnet 4 · ElevenLabs (Marta voice, pt-PT)", back: "← Portfolio" },
  retell: { badge: "Pipeline · Retell", title: "Retell AI", titleHighlight: "Voice Pipeline", descBefore: "This demo uses", descBold: "Retell AI", descAfter: "to compare another pipeline orchestrator.", powered: "Retell · Gemini · ElevenLabs (Marta voice, pt-PT)", back: "← Portfolio" },
  twilio: { badge: "Telephony · Twilio", title: "Twilio", titleHighlight: "ConversationRelay", descBefore: "This demo uses", descBold: "Twilio ConversationRelay", descAfter: "for real phone calls.", powered: "Twilio ConversationRelay · Claude · ElevenLabs", back: "← Portfolio", phoneSoon: "Number coming soon", phoneLabel: "Or call:" },
  widgets: {
    common: {
      connecting: "Connecting…",
      endCall: "End call",
      you: "You",
      agentName: "Ana",
    },
    hume: {
      callButton: "Talk to Ana",
      requestingMic: "Requesting microphone…",
      disconnecting: "Disconnecting…",
      retry: "Try again",
      speaking: "Ana is speaking…",
      listening: "Listening…",
      errors: {
        noMicSupport: "Browser doesn't support microphone access",
        micDenied: "Microphone permission denied",
        noMic: "No microphone found",
        micInUse: "Microphone is in use by another app",
        micAccessFailed: "Failed to access microphone",
        noToken: "Couldn't get an access token",
        connectionError: "Connection error",
        connectFailedPrefix: "Connection failed: ",
        unknownError: "Unknown error",
        genericError: "Error",
      },
    },
    livekit: {
      callButton: "Talk to Ana — Gemini Live",
      statusListening: "Listening…",
      statusThinking: "Thinking…",
      statusSpeaking: "Speaking…",
    },
    elevenlabs: {
      callButton: "Talk to Ana — free, right now",
      ending: "Ending…",
      listening: "Ana is listening…",
      inputPlaceholder: "Type a message…",
      inputPlaceholderDisabled: "Connect first to chat with Ana",
      send: "Send",
    },
    vapi: { callButton: "Talk to Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
    retell: { callButton: "Talk to Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
    twilio: { callButton: "Call Ana", ending: "Ending…", listening: "Ana is listening…", unavailable: "Unavailable — coming soon" },
    callMe: {
      heading: "Prefer to receive the call?",
      description: "Enter your number and Ana will call you in seconds.",
      placeholder: "+1 555 123 4567",
      button: "Call Me",
      calling: "Calling...",
      success: "Ana is calling you now!",
      error: "Failed to start the call. Please try again.",
    },
    qrCode: {
      caption: "Scan to call",
    },
    phoneNumber: {
      copy: "Copy number",
      copied: "Copied!",
    },
    callStats: {
      callsReceived: "calls received",
      languages: "languages",
      avgDuration: "avg duration",
      qualifiedLeads: "qualified leads",
      appointmentsBooked: "appointments booked",
    },
  },
};

export const dictionaries: Record<Lang, Dict> = { pt, en };
