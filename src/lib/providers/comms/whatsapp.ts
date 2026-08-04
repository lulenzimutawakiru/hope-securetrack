/**
 * Meta WhatsApp Cloud API — text messages.
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { createHmac, timingSafeEqual } from "crypto";
import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { ProviderCallResult, WhatsAppInput } from "../types";

function normalizeMsisdn(to: string): string {
  return to.replace(/\D/g, "");
}

export async function sendWhatsApp(
  input: WhatsAppInput
): Promise<ProviderCallResult<{ messageId?: string }>> {
  const cfg = providersConfig.whatsapp;
  const to = normalizeMsisdn(input.to);
  if (!to) {
    return { ok: false, provider: "whatsapp", error: "Invalid WhatsApp recipient" };
  }

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("whatsapp", {
      messageId: `wamid.sandbox.${Date.now()}`,
      to,
      message: input.message.slice(0, 200),
    });
  }

  try {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
    };

    if (input.templateName) {
      payload.type = "template";
      payload.template = {
        name: input.templateName,
        language: { code: input.templateLang || "en" },
        components: input.templateParams?.length
          ? [
              {
                type: "body",
                parameters: input.templateParams.map((t) => ({
                  type: "text",
                  text: t,
                })),
              },
            ]
          : undefined,
      };
    } else {
      payload.type = "text";
      payload.text = { preview_url: false, body: input.message.slice(0, 4096) };
    }

    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/${cfg.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const body = json as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (res.ok && body.messages?.[0]?.id) {
      return {
        ok: true,
        status: res.status,
        provider: "whatsapp",
        externalId: body.messages[0].id,
        data: { messageId: body.messages[0].id },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "whatsapp",
      error: body.error?.message || text.slice(0, 300) || `WhatsApp HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "whatsapp",
      error: e instanceof Error ? e.message : "WhatsApp send failed",
    };
  }
}

/** Verify X-Hub-Signature-256 from Meta webhooks */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = providersConfig.whatsapp.appSecret;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  try {
    const expected =
      "sha256=" +
      createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
