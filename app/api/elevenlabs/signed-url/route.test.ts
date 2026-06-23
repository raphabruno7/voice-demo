import { GET } from "./route";
import { NextRequest } from "next/server";
import { NICHES, NICHE_KEYS } from "@/lib/niches";

// Mock environment variables
process.env.ELEVENLABS_AGENT_ID = "test-agent-id";
process.env.ELEVENLABS_API_KEY = "test-api-key";

// Mock fetch globally
global.fetch = jest.fn();

describe("GET /api/elevenlabs/signed-url", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return signed URL without niche parameter", async () => {
    const mockSignedUrl = "https://example.com/signed-url";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signed_url: mockSignedUrl }),
    });

    const req = new NextRequest("http://localhost:3000/api/elevenlabs/signed-url");
    const response = await GET(req);
    const data = await response.json();

    expect(data.signedUrl).toBe(mockSignedUrl);
    expect(data.niche).toBeNull();
    expect(data.nicheOverride).toBeNull();
  });

  it("should handle valid niche parameter and return nicheOverride", async () => {
    const mockSignedUrl = "https://example.com/signed-url";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signed_url: mockSignedUrl }),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/elevenlabs/signed-url?niche=restaurantes"
    );
    const response = await GET(req);
    const data = await response.json();

    expect(data.signedUrl).toBe(mockSignedUrl);
    expect(data.niche).toBe("restaurantes");
    expect(data.nicheOverride).toContain("[NICHE: sector=");
    expect(data.nicheOverride).toContain("Dor:");
  });

  it("should ignore invalid niche parameter", async () => {
    const mockSignedUrl = "https://example.com/signed-url";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signed_url: mockSignedUrl }),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/elevenlabs/signed-url?niche=invalid"
    );
    const response = await GET(req);
    const data = await response.json();

    expect(data.signedUrl).toBe(mockSignedUrl);
    expect(data.niche).toBe("invalid");
    expect(data.nicheOverride).toBeNull();
  });

  it("should return error when ElevenLabs API fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const req = new NextRequest("http://localhost:3000/api/elevenlabs/signed-url");
    const response = await GET(req);
    const data = await response.json();

    expect(data.error).toBe("Failed to get signed URL");
    expect(response.status).toBe(500);
  });

  it("should construct correct ElevenLabs API URL", async () => {
    const mockSignedUrl = "https://example.com/signed-url";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signed_url: mockSignedUrl }),
    });

    const req = new NextRequest("http://localhost:3000/api/elevenlabs/signed-url");
    await GET(req);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toContain("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
    expect(fetchCall[0]).toContain("agent_id=test-agent-id");
    expect(fetchCall[1].headers["xi-api-key"]).toBe("test-api-key");
  });
});
