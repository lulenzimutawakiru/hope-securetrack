import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/platform/", "/admin/"],
      },
    ],
    sitemap: "https://hope-securetrack.vercel.app/sitemap.xml",
  };
}