/**
 * Browser helpers for calling authenticated SecureTrack API routes.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code?: string; details?: unknown };

export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      const message =
        json?.error?.message ||
        json?.error ||
        json?.message ||
        `Request failed (${res.status})`;
      return {
        ok: false,
        error: String(message),
        status: res.status,
        code: json?.error?.code,
        details: json?.error?.details || json?.details,
      };
    }
    return { ok: true, data: (json.data ?? json) as T };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }
}

export async function apiGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: String(json?.error?.message || json?.error || `GET failed (${res.status})`),
        status: res.status,
        code: json?.error?.code,
      };
    }
    return { ok: true, data: (json.data ?? json) as T };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }
}

/**
 * Prompt for dual-control request UUID when production gates return 403.
 * Returns null if user cancels.
 */
export function promptDualControlId(message?: string): string | null {
  if (typeof window === "undefined") return null;
  const id = window.prompt(
    message ||
      "Dual-control required. Paste approved dual_control request UUID (Security → Dual Control):"
  );
  const t = id?.trim();
  if (!t) return null;
  // basic UUID shape check
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t
    )
  ) {
    return t; // still allow; server will validate
  }
  return t;
}
