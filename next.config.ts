import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

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
    // Client router cache: reuse RSC payloads for 30s on dynamic routes so
    // in-app navigation (sidebar clicks) feels instant without refetching.
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
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

// Single merged config: next-intl plugin (was previously only in next.config.mjs,
// which Next.js ignores when next.config.ts exists) + the full runtime config
// above. Keeps locale message resolution wired while preserving build flags.
const withNextIntl = createNextIntlPlugin("./i18n.ts");

export default withNextIntl(nextConfig);