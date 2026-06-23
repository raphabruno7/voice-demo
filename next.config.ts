import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: "/ai-agent-voice",
  assetPrefix: isProd ? "https://voice-demo-navy.vercel.app/ai-agent-voice" : undefined,
  trailingSlash: true,
};

export default nextConfig;
