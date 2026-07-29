import { createClient } from "@/lib/supabase/client";

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
  // Keep as JSON string
  return t;
}

export async function loadSettingsMap(
  companyId: string,
  keys?: string[]
): Promise<Record<string, string>> {
  const supabase = createClient();
  let q = supabase.from("system_settings").select("key, value").eq("company_id", companyId);
  if (keys?.length) q = q.in("key", keys);
  const { data } = await q;
  const map: Record<string, string> = {};
  data?.forEach((s) => {
    map[s.key] = settingToString(s.value);
  });
  return map;
}

export async function upsertSettings(
  companyId: string,
  userId: string | null,
  updates: Record<string, string>,
  descriptions?: Record<string, string>
): Promise<{ error: string | null }> {
  const supabase = createClient();
  for (const [key, raw] of Object.entries(updates)) {
    const value = parseSettingValue(raw);
    const { data: existing } = await supabase
      .from("system_settings")
      .select("id, value")
      .eq("company_id", companyId)
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("system_settings")
        .update({
          value,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) return { error: error.message };
      await supabase.from("config_change_log").insert({
        company_id: companyId,
        entity_type: "system_setting",
        entity_id: existing.id,
        action: "update",
        field_name: key,
        old_value: settingToString(existing.value),
        new_value: raw,
        changed_by: userId,
      });
    } else {
      const { data: created, error } = await supabase
        .from("system_settings")
        .insert({
          company_id: companyId,
          key,
          value,
          description: descriptions?.[key] ?? null,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      await supabase.from("config_change_log").insert({
        company_id: companyId,
        entity_type: "system_setting",
        entity_id: created?.id,
        action: "create",
        field_name: key,
        new_value: raw,
        changed_by: userId,
      });
    }
  }
  return { error: null };
}
