/**
 * Document AI / OCR for AP invoice extraction.
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import { assertPublicHttpUrl } from "../../security/ssrf";
import type { ProviderCallResult } from "../types";

export type OcrExtractInput = {
  /** Base64 document content or publicly reachable URL */
  contentBase64?: string;
  contentUrl?: string;
  mimeType?: string;
  companyId?: string;
};

export type OcrExtractResult = {
  vendor?: string;
  invoice_number?: string;
  total?: number;
  currency?: string;
  date?: string;
  line_items?: Array<{ description?: string; amount?: number }>;
  raw_text?: string;
};

export async function extractDocument(
  input: OcrExtractInput
): Promise<ProviderCallResult<OcrExtractResult>> {
  const cfg = providersConfig.documentAi;

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("document_ai", {
      vendor: "Sandbox Supplies Ltd",
      invoice_number: `INV-OCR-${Date.now().toString(36).toUpperCase()}`,
      total: 150000,
      currency: "UGX",
      date: new Date().toISOString().slice(0, 10),
      line_items: [
        { description: "Sample extracted line", amount: 150000 },
      ],
      raw_text: "SANDBOX OCR — configure DOCUMENT_AI_* for live extraction",
    });
  }

  if (input.contentUrl) {
    const urlErr = await assertPublicHttpUrl(input.contentUrl);
    if (urlErr) {
      return {
        ok: false,
        provider: "document_ai",
        error: `Unsafe content URL: ${urlErr}`,
      };
    }
  }

  try {
    const { res, json, text } = await providerFetch(cfg.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        processor_id: cfg.processorId,
        mime_type: input.mimeType || "application/pdf",
        content: input.contentBase64,
        content_url: input.contentUrl,
      }),
    });

    if (!res.ok) {
      return {
        ok: false,
        provider: "document_ai",
        status: res.status,
        error: text.slice(0, 300),
        raw: json,
      };
    }

    const body = json as OcrExtractResult;
    return {
      ok: true,
      provider: "document_ai",
      status: res.status,
      data: body,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "document_ai",
      error: e instanceof Error ? e.message : "OCR failed",
    };
  }
}
