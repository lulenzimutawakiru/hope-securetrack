import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Enables Docker/K8s standalone server.js output
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  // Large multi-module ERP (~900+ dashboard routes): avoid OOM on 8GB builders
  staticPageGenerationTimeout: 120,
  experimental: {
    webpackMemoryOptimizations: true,
    cpus: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(self), microphone=(), geolocation=(self)",
        },
      ],
    },
  ],
  // Next 16+: eslint config moved out of next.config; use `next lint` / CI separately
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
