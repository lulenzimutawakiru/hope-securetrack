import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  buildDocumentHtml,
  applyCompanyBrand,
  type BusinessDocument,
} from "@/lib/documents";
import { resolveCompanyBranding } from "@/lib/branding/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LINES = 500;

const schema = z.object({
  doc: z.record(z.unknown()),
});

function sanitizeDoc(raw: unknown): BusinessDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const title = typeof doc.title === "string" ? doc.title.slice(0, 200) : "";
  const docType =
    typeof doc.docType === "string" ? doc.docType.slice(0, 80) : "";
  const number = typeof doc.number === "string" ? doc.number.slice(0, 80) : "";
  if (!docType && !number && !title) return null;
  const lines = Array.isArray(doc.lines) ? doc.lines.slice(0, MAX_LINES) : [];
  return {
    ...(doc as BusinessDocument),
    title,
    docType,
    number,
    lines,
  };
}

/**
 * Render a branded ERP document to PDF.
 * Company from session only (never request body).
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "dashboard.view",
      "invoices.view",
      "billing.view",
      "sales.view",
      "print.view",
      "reports.documents",
      "reports.view",
    ],
    bodySchema: schema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "documents",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const doc = sanitizeDoc(data.doc);
    if (!doc) {
      return apiError("VALIDATION", "Document payload is invalid");
    }

    const supabase = await createClient();
    const brand = await resolveCompanyBranding(supabase, ctx.companyId);
    const branded = applyCompanyBrand(doc, brand);
    const html = buildDocumentHtml(branded);

    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      return NextResponse.json(
        { ok: false, error: "PDF engine unavailable on this deployment" },
        { status: 501 }
      );
    }

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1024, height: 800 },
      });
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
      });
      await browser.close();

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${(doc.number || "document").replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      try {
        await browser?.close();
      } catch {
        /* ignore */
      }
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "PDF generation failed",
        500
      );
    }
  }
);
