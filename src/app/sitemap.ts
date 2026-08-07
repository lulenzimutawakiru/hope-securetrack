import type { MetadataRoute } from "next";

const BASE = "https://hope-securetrack.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "", "/solutions", "/industries", "/modules", "/ai-platform", "/security",
    "/pricing", "/customers", "/resources", "/contact", "/partners",
    "/developers", "/company", "/login", "/register",
    "/legal/privacy", "/legal/terms", "/legal/cookies",
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${BASE}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  ];
}