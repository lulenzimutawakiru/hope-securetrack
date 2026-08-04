/**
 * System settings — CRUD-backed (no browser Supabase client).
 */

import {
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

/** Normalize JSONB system_settings value to a display string */
export function settingToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Coerce form string into JSONB-compatible value */
export function parseSettingValue(raw: string): unknown {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) {
    return Number(t);
  }
  return t;
}

export async function loadSettingsMap(
  companyId: string,
  keys?: string[]
): Promise<Record<string, string>> {
  void companyId;
  const rows = await mustList<Record<string, unknown>>("system_settings", {
    pageSize: 200,
  });
  const map: Record<string, string> = {};
  for (const s of rows) {
    const key = String(s.key || "");
    if (keys?.length && !keys.includes(key)) continue;
    map[key] = settingToString(s.value);
  }
  return map;
}

export async function upsertSettings(
  companyId: string,
  userId: string | null,
  updates: Record<string, string>,
  descriptions?: Record<string, string>
): Promise<{ error: string | null }> {
  void descriptions;
  try {
    const existing = await mustList<Record<string, unknown>>("system_settings", {
      pageSize: 200,
    });
    const byKey = new Map(existing.map((r) => [String(r.key), r]));

    for (const [key, raw] of Object.entries(updates)) {
      const value = parseSettingValue(raw);
      const prev = byKey.get(key);
      if (prev?.id) {
        await mustUpdate("system_settings", String(prev.id), {
          value,
          updated_by: userId,
        });
        try {
          await mustCreate("config_change_log", {
            entity_type: "system_setting",
            entity_id: prev.id,
            action: "update",
            field_name: key,
            old_value: settingToString(prev.value),
            new_value: raw,
            changed_by: userId,
          });
        } catch {
          /* optional */
        }
      } else {
        await mustCreate("system_settings", {
          key,
          value,
          description: descriptions?.[key] || null,
          updated_by: userId,
        });
      }
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Settings update failed" };
  }
}
