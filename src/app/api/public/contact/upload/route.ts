import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "marketing-attachments";
const MAX_BYTES = 3 * 1024 * 1024; // must match bucket file_size_limit
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || "attachment";
}

function buildObjectName(originalName: string, mime: string): string {
  const ext = ALLOWED_MIME[mime];
  const base = sanitizeFileName(originalName.replace(/\.[a-zA-Z0-9]+$/, ""));
  return base + ext;
}

/**
 * Public upload for contact-form attachments. Stores into a private bucket
 * using the service role; the returned object path is saved on the lead.
 * The bucket allows only safe document/image types at <= 3MB.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("contact-upload", 20, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many uploads from this network. Try later." },
        { status: 429, headers: rl.response.headers }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME[mime]) {
      return NextResponse.json(
        { ok: false, error: "File type not allowed. Use PDF, Word, Excel, CSV, TXT, JPEG, PNG, or WebP." },
        { status: 415 }
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "File must be smaller than 3 MB." },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const path = `marketing/leads/${randomUUID()}/${buildObjectName(file.name || "attachment", mime)}`;

    const sb = createAdminClient();
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: "Upload failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: { path, name: path.split("/").pop(), size: file.size, mimeType: mime },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Upload could not be completed" },
      { status: 500 }
    );
  }
}