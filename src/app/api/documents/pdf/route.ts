import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDocumentHtml, applyCompanyBrand, type BusinessDocument } from "@/lib/documents";
import { resolveCompanyBranding } from "@/lib/branding/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LINES = 500;

function sanitizeDoc(raw: unknown): BusinessDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const title = typeof doc.title === "string" ? doc.title.slice(0, 200) : "";
  const docType = typeof doc.docType === "string" ? doc.docType.slice(0, 80) : "";
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
 * Render a branded ERP document (invoice, quotation, report, payslip, ...) to
 * a downloadable PDF. The company is resolved from the authenticated session,
 * never from the request body (AGENTS.md tenant rules).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  const companyId = (profile?.company_id as string) || null;

  let body: { doc?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const doc = sanitizeDoc(body.doc);
  if (!doc) {
    return NextResponse.json({ error: "Document payload is invalid" }, { status: 400 });
  }

  // Brand server-side from the session company
  const brand = await resolveCompanyBranding(supabase, companyId);
  const branded = applyCompanyBrand(doc, brand);
  const html = buildDocumentHtml(branded);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return NextResponse.json(
      { error: "PDF engine unavailable on this deployment" },
      { status: 501 }
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({
      viewport: { width: 1024, height: 800 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    await browser.close();

    const filename = `${(branded.docType || "document").replace(/\s+/g, "-").toLowerCase()}-${branded.number || Date.now()}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}