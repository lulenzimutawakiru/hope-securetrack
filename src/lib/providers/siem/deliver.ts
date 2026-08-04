/**
 * Real SIEM HTTP delivery (Splunk HEC, Elastic, generic webhook, Sentinel).
 */

import { providerFetch } from "../http";
import type { ProviderCallResult, SiemDeliverInput } from "../types";

export async function deliverSiemEvent(
  input: SiemDeliverInput
): Promise<ProviderCallResult<{ delivered: boolean }>> {
  if (!input.endpointUrl?.startsWith("https://")) {
    return {
      ok: false,
      provider: input.provider,
      error: "SIEM endpoint must be https",
    };
  }

  const provider = (input.provider || "webhook").toLowerCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...input.headers,
  };

  let body: string;
  if (provider === "splunk") {
    // HEC event envelope
    body = JSON.stringify({
      event: input.payload,
      sourcetype: "hope:eal",
      source: "hope-securetrack",
    });
    if (input.token) headers.Authorization = `Splunk ${input.token}`;
  } else if (provider === "elastic") {
    body = JSON.stringify(input.payload);
    if (input.token) headers.Authorization = `ApiKey ${input.token}`;
  } else if (provider === "sentinel") {
    body = JSON.stringify([input.payload]);
    if (input.token) headers.Authorization = `Bearer ${input.token}`;
  } else {
    body = JSON.stringify(input.payload);
    if (input.token) headers.Authorization = `Bearer ${input.token}`;
  }

  try {
    const { res, text, json } = await providerFetch(input.endpointUrl, {
      method: "POST",
      headers,
      body,
      timeoutMs: 20_000,
    });

    if (res.ok || res.status === 204) {
      return {
        ok: true,
        provider,
        status: res.status,
        data: { delivered: true },
        raw: json || { text: text.slice(0, 200) },
      };
    }

    return {
      ok: false,
      provider,
      status: res.status,
      error: text.slice(0, 400) || `SIEM HTTP ${res.status}`,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider,
      error: e instanceof Error ? e.message : "SIEM delivery failed",
    };
  }
}
