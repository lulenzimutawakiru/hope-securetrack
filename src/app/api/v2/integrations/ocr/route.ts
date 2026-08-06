/**
 * Document OCR extraction for AP / procurement.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { extractDocument } from "@/lib/providers/docs/ocr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  content_base64: z.string().max(8_000_000).optional(),
  content_url: z.string().url().max(2048).optional(),
  mime_type: z.string().max(100).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "finance.manage",
      "procurement.manage",
      "intg.manage",
      "documents.manage",
    ],
    module: "ocr",
    bodySchema: schema,
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    const input = body as z.infer<typeof schema>;
    const r = await extractDocument({
      contentBase64: input.content_base64,
      contentUrl: input.content_url,
      mimeType: input.mime_type,
      companyId: ctx!.companyId,
    });
    return r.ok
      ? apiOk(r)
      : apiError("INTERNAL", r.error || "OCR failed", 502);
  }
);
