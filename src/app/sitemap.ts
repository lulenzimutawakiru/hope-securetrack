import type { MetadataRoute } from "next";

const BASE = "https://hope-securetrack.vercel.app";

const ROUTES = [
  "",
  "/solutions",
  "/industries",
  "/modules",
  "/ai-platform",
  "/pricing",
  "/customers",
  "/resources",
  "/partners",
  "/developers",
  "/company",
  "/security",
  "/contact",
  "/careers",
  "/careers/apply",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${BASE}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}