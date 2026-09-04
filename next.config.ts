import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ai-agent-voice",
  assetPrefix:
    process.env.NODE_ENV === "production"
      ? "https://voice-demo-navy.vercel.app/ai-agent-voice"
      : undefined,
  trailingSlash: true,
};

export default nextConfig;
