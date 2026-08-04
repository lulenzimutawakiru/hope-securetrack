/**
 * Africa's Talking SMS API
 * https://developers.africastalking.com/docs/sms/overview
 */

import { providersConfig } from "../config";
import { providerFetch, sandboxResult } from "../http";
import type { ProviderCallResult, SmsInput } from "../types";

export async function sendSms(
  input: SmsInput
): Promise<ProviderCallResult<{ messageId?: string; recipients?: number }>> {
  const cfg = providersConfig.africastalking;
  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((t) => t.trim())
    .filter(Boolean);

  if (!toList.length) {
    return { ok: false, provider: "africastalking", error: "No recipients" };
  }

  if (!cfg.configured || cfg.sandbox) {
    return sandboxResult("africastalking", {
      messageId: `AT-sandbox-${Date.now()}`,
      recipients: toList.length,
      to: toList,
      message: input.message.slice(0, 160),
    });
  }

  try {
    const body = new URLSearchParams();
    body.set("username", cfg.username);
    body.set("to", toList.join(","));
    body.set("message", input.message);
    if (input.from || cfg.from) body.set("from", input.from || cfg.from);

    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/messaging`,
      {
        method: "POST",
        headers: {
          apiKey: cfg.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const data = json as {
      SMSMessageData?: {
        Message?: string;
        Recipients?: Array<{ statusCode?: number; messageId?: string; status?: string }>;
      };
    };
    const recipients = data?.SMSMessageData?.Recipients || [];
    const ok =
      res.ok &&
      recipients.some((r) => r.statusCode === 101 || r.status === "Success");

    if (ok || (res.ok && recipients.length)) {
      return {
        ok: true,
        status: res.status,
        provider: "africastalking",
        externalId: recipients[0]?.messageId,
        data: {
          messageId: recipients[0]?.messageId,
          recipients: recipients.length,
        },
        raw: json,
      };
    }

    return {
      ok: false,
      status: res.status,
      provider: "africastalking",
      error:
        data?.SMSMessageData?.Message ||
        text.slice(0, 300) ||
        `AT SMS HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "africastalking",
      error: e instanceof Error ? e.message : "SMS send failed",
    };
  }
}
