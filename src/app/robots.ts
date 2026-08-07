import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/verify", "/register", "/login", "/mfa", "/portal", "/welcome", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: "https://hope-securetrack.vercel.app/sitemap.xml",
  };
}