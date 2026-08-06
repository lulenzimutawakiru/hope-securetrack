/**
 * SecureChat server helpers — session-scoped Supabase (SSR createClient).
 * Used by /api/v2/hopechat/* routes. Never accept client company/tenant IDs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatPerson = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  first_name: string | null;
  last_name: string | null;
};

function displayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const n = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return n || u.email || "User";
}

/**
 * List active company colleagues for DM picker.
 * Session company is authoritative; optional search filters client-side-safe.
 */
export async function listCompanyPeopleServer(
  sb: SupabaseClient,
  companyId: string,
  opts: { search?: string; excludeUserId?: string; limit?: number } = {}
): Promise<ChatPerson[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const search = opts.search?.trim().toLowerCase();

  // Primary: profiles on this company
  const q = sb
    .from("user_profiles")
    .select("id, first_name, last_name, email, avatar_url, job_title, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("first_name", { ascending: true })
    .limit(limit);

  // Soft-delete when present
  const withDeleted = await q.is("deleted_at", null);
  let rows = withDeleted.data;
  let error = withDeleted.error;

  if (
    error &&
    /deleted_at|column .* does not exist|42703/i.test(
      `${error.message || ""} ${error.code || ""}`
    )
  ) {
    const retry = await sb
      .from("user_profiles")
      .select("id, first_name, last_name, email, avatar_url, job_title, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("first_name", { ascending: true })
      .limit(limit);
    rows = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message || "Failed to load people");
  }

  const byId = new Map<string, ChatPerson>();

  for (const u of rows || []) {
    if (!u?.id) continue;
    if (opts.excludeUserId && u.id === opts.excludeUserId) continue;
    byId.set(u.id, {
      id: u.id,
      first_name: u.first_name ?? null,
      last_name: u.last_name ?? null,
      email: u.email ?? null,
      avatar_url: u.avatar_url ?? null,
      job_title: u.job_title ?? null,
      name: displayName(u),
    });
  }

  // Multi-company: users with active membership (best-effort; ignore if table missing)
  try {
    const { data: members } = await sb
      .from("user_company_memberships")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("status", "active")
      .limit(limit);

    const extraIds = (members || [])
      .map((m) => m.user_id as string)
      .filter((id) => id && id !== opts.excludeUserId && !byId.has(id));

    if (extraIds.length) {
      const { data: extras } = await sb
        .from("user_profiles")
        .select("id, first_name, last_name, email, avatar_url, job_title, is_active")
        .in("id", extraIds)
        .eq("is_active", true);
      for (const u of extras || []) {
        if (!u?.id || byId.has(u.id)) continue;
        byId.set(u.id, {
          id: u.id,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          email: u.email ?? null,
          avatar_url: u.avatar_url ?? null,
          job_title: u.job_title ?? null,
          name: displayName(u),
        });
      }
    }
  } catch {
    /* memberships optional */
  }

  let people = [...byId.values()];
  if (search) {
    people = people.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.email || "").toLowerCase().includes(search) ||
        (p.job_title || "").toLowerCase().includes(search)
    );
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return people.slice(0, limit);
}

/**
 * Find existing DM or create a private 1:1 channel with both members.
 */
export async function startDmServer(
  sb: SupabaseClient,
  input: {
    company_id: string;
    self_id: string;
    self_name: string;
    other_id: string;
    other_name: string;
  }
): Promise<Record<string, unknown>> {
  if (!input.self_id || !input.other_id) {
    throw new Error("Both participants are required");
  }
  if (input.self_id === input.other_id) {
    throw new Error("Cannot start a direct message with yourself");
  }

  // Verify other user is in company (profiles or membership)
  const { data: otherProfile } = await sb
    .from("user_profiles")
    .select("id, company_id, is_active")
    .eq("id", input.other_id)
    .maybeSingle();

  let otherOk =
    otherProfile &&
    otherProfile.is_active !== false &&
    otherProfile.company_id === input.company_id;

  if (!otherOk) {
    const { data: mem } = await sb
      .from("user_company_memberships")
      .select("id")
      .eq("user_id", input.other_id)
      .eq("company_id", input.company_id)
      .eq("status", "active")
      .maybeSingle();
    otherOk = !!mem;
  }
  if (!otherOk) {
    throw new Error("That user is not an active member of your company");
  }

  const { data: myMemberships, error: memErr } = await sb
    .from("hc_channel_members")
    .select("channel_id")
    .eq("user_id", input.self_id)
    .eq("company_id", input.company_id);
  if (memErr) throw new Error(memErr.message);

  for (const m of myMemberships || []) {
    const { data: ch } = await sb
      .from("hc_channels")
      .select("*")
      .eq("id", m.channel_id)
      .eq("channel_type", "dm")
      .eq("company_id", input.company_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ch) continue;
    const { data: other } = await sb
      .from("hc_channel_members")
      .select("user_id")
      .eq("channel_id", ch.id)
      .eq("user_id", input.other_id)
      .maybeSingle();
    if (other) return ch as Record<string, unknown>;
  }

  const name =
    [input.self_name, input.other_name].filter(Boolean).join("  ·  ") ||
    "Direct message";
  const slug = `dm-${input.self_id.slice(0, 8)}-${input.other_id.slice(0, 8)}-${Date.now().toString(36)}`;

  const { data: channel, error: chErr } = await sb
    .from("hc_channels")
    .insert({
      company_id: input.company_id,
      name,
      slug,
      channel_type: "dm",
      is_private: true,
      created_by: input.self_id,
    })
    .select("*")
    .single();
  if (chErr) {
    throw new Error(
      /row-level security|42501/i.test(chErr.message)
        ? "Cannot create DM: missing chat permission (hc.view) or channel policy blocked create. Apply SecureChat RLS migrations and ensure hc.view is granted."
        : chErr.message
    );
  }

  // Creator first, then peer (RLS allows creator to add members on private channels they created)
  for (const [uid, role] of [
    [input.self_id, "owner"],
    [input.other_id, "member"],
  ] as const) {
    const { error: mErr } = await sb.from("hc_channel_members").insert({
      company_id: input.company_id,
      channel_id: channel.id,
      user_id: uid,
      role,
      joined_at: new Date().toISOString(),
    });
    if (mErr && !/duplicate|unique|23505/i.test(mErr.message || "")) {
      if (uid === input.self_id) {
        throw new Error(
          /row-level security|42501/i.test(mErr.message)
            ? "Cannot join DM channel (RLS). Ensure hc.view is granted."
            : mErr.message
        );
      }
      // Peer insert failure: leave channel for self; peer can still be invited later
    }
  }

  await sb.from("hc_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.self_id,
    action: "create_dm",
    entity_type: "hc_channels",
    entity_id: channel.id,
    details: name,
  });

  return channel as Record<string, unknown>;
}
