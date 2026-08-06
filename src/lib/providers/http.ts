/**
 * Shared HTTP helper for provider clients. Web-safe only: this module is
 * reachable from client components (SIEM audit export page), so it must not
 * import node builtins. Server-only SSRF checks live in lib/security/ssrf.
 */

export async function providerFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ res: Response; text: string; json: unknown }> {
  const timeoutMs = init?.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _t, ...rest } = init || {};
    void _t;
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 4000) };
    }
    return { res, text, json };
  } finally {
    clearTimeout(timer);
  }
}

export function sandboxResult<T extends Record<string, unknown>>(
  provider: string,
  data: T,
  externalId?: string
) {
  return {
    ok: true as const,
    status: 200,
    provider,
    sandbox: true,
    externalId: externalId || `sandbox-${Date.now().toString(36)}`,
    data,
    raw: { sandbox: true, ...data },
  };
}
