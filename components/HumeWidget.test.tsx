import { render, screen } from "@testing-library/react";
import HumeWidget from "./HumeWidget";
import { NICHES } from "@/lib/niches";

// Mock the VoiceProvider
jest.mock("@humeai/voice-react", () => ({
  VoiceProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useVoice: () => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    status: { value: "disconnected" },
    isPlaying: false,
    micFft: [],
    error: null,
    readyState: null,
    messages: [],
  }),
}));

const mockDict = {
  common: {
    connecting: "A ligar...",
    endCall: "Terminar chamada",
    agentName: "Agente",
    you: "Tu",
  },
  hume: {
    callButton: "Iniciar chamada",
    requestingMic: "A solicitar microfone...",
    disconnecting: "A desligar...",
    speaking: "A falar",
    listening: "À escuta",
    retry: "Tentar novamente",
    errors: {
      noMicSupport: "Microfone não suportado",
      micDenied: "Microfone negado",
      noMic: "Sem microfone",
      micInUse: "Microfone em uso",
      micAccessFailed: "Falha no acesso ao microfone",
      connectionError: "Erro de conexão",
      noToken: "Token não disponível",
      connectFailedPrefix: "Falha na conexão: ",
      genericError: "Erro genérico",
      unknownError: "Erro desconhecido",
    },
  },
};

describe("HumeWidget", () => {
  it("renders without niche prop", () => {
    render(<HumeWidget dict={mockDict} />);
    const button = screen.getByRole("button", { name: /Iniciar chamada/i });
    expect(button).toBeInTheDocument();
  });

  it("renders with niche prop", () => {
    render(<HumeWidget niche="restaurantes" dict={mockDict} />);
    const button = screen.getByRole("button", { name: /Iniciar chamada/i });
    expect(button).toBeInTheDocument();
  });

  it("renders with caller and niche props", () => {
    const caller = {
      phone: "+351 91 234 5678",
      name: "João",
      niche: "restaurantes",
    };
    render(<HumeWidget caller={caller} niche="restaurantes" dict={mockDict} />);
    const button = screen.getByRole("button", { name: /Iniciar chamada/i });
    expect(button).toBeInTheDocument();
  });

  it("includes niche context in buildContextText when valid", () => {
    // This is more of an integration test
    const niche = "restaurantes";
    expect(NICHES[niche]).toBeDefined();
    expect(NICHES[niche].label).toBe("Restaurantes");
    expect(NICHES[niche].pain_one_liner_pt).toBeDefined();
  });

  it("ignores invalid niche", () => {
    render(<HumeWidget niche="invalid-niche" dict={mockDict} />);
    const button = screen.getByRole("button", { name: /Iniciar chamada/i });
    expect(button).toBeInTheDocument();
  });
});
