/**
 * Platform cPanel - Advanced Sales CRM (SecureTrack staff only).
 *
 * GET    ?resource=overview   -> aggregate pipeline, accounts, contacts, activities, templates + stats
 *        ?resource=accounts   -> account list (search / status / industry)
 *        ?resource=contacts   -> contact list (search / account_id)
 *        ?resource=deals      -> deal list (search / stage / scope)
 *        ?resource=activities -> activity list (kind / done / due)
 *        ?resource=templates  -> reusable email templates
 *        ?resource=stages     -> configurable pipeline stages
 * POST   { resource, data }   -> create accounts/contacts/deals/activities, convert a lead
 * PATCH  { resource, id, data } -> update; deal stage moves recompute probability + won/lost
 * DELETE ?resource=&id=       -> soft delete (query string)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess, type PlatformStaffRole } from "@/lib/platform";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalUuid = () => z.string().uuid().optional().nullable();
const optionalDate = () =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, "Expected a valid date")
    .optional()
    .nullable();

const accountFields = {
  name: z.string().trim().min(2).max(180),
  website: optionalText(255),
  industry: optionalText(120),
  country: optionalText(120),
  city: optionalText(120),
  size_band: optionalText(40),
  phone: optionalText(40),
  email: optionalText(255),
  source: optionalText(60),
  lead_id: optionalUuid(),
  description: optionalText(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
};

const contactFields = {
  account_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: optionalText(255),
  phone: optionalText(40),
  job_title: optionalText(120),
  department: optionalText(120),
  is_primary: z.boolean().optional(),
  source: optionalText(60),
  notes: optionalText(4000),
};

const dealFields = {
  account_id: z.string().uuid(),
  contact_id: optionalUuid(),
  name: z.string().trim().min(2).max(200),
  amount: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  stage_id: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  owner_id: optionalUuid(),
  source: optionalText(60),
  lead_id: optionalUuid(),
  expected_close: optionalDate(),
  notes: optionalText(4000),
};

const activityFields = {
  kind: z
    .enum(["call", "meeting", "email", "note", "task", "follow_up"])
    .optional(),
  subject: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  account_id: optionalUuid(),
  contact_id: optionalUuid(),
  deal_id: optionalUuid(),
  lead_id: optionalUuid(),
  due_at: z.string().trim().optional().nullable(),
  owner_id: optionalUuid(),
  outcome: optionalText(200),
  done: z.boolean().optional(),
};

const postSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("accounts"), data: z.object(accountFields) }),
  z.object({ resource: z.literal("contacts"), data: z.object(contactFields) }),
  z.object({ resource: z.literal("deals"), data: z.object(dealFields) }),
  z.object({ resource: z.literal("activities"), data: z.object(activityFields) }),
  z.object({
    resource: z.literal("convert"),
    data: z.object({
      lead_id: z.string().uuid(),
      account_id: z.string().uuid().optional().nullable(),
      owner_id: z.string().uuid().optional().nullable(),
    }),
  }),
]);

const accountPatch = z.object(accountFields).partial();
const contactPatch = z.object(contactFields).partial();
const dealPatch = z.object(dealFields).partial();
const activityPatch = z.object(activityFields).partial();

const patchSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("accounts"), id: z.string().uuid(), data: accountPatch }),
  z.object({ resource: z.literal("contacts"), id: z.string().uuid(), data: contactPatch }),
  z.object({ resource: z.literal("deals"), id: z.string().uuid(), data: dealPatch }),
  z.object({ resource: z.literal("activities"), id: z.string().uuid(), data: activityPatch }),
]);


/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const v = row[key] == null || row[key] === "" ? "Unknown" : String(row[key]);
    out[v] = (out[v] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function sum(rows: Row[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function mapById(rows: Row[]): Map<string, Row> {
  return new Map(rows.map((r) => [String(r.id), r]));
}

function decorateNames(
  row: Row,
  maps: {
    account?: Map<string, Row>;
    contact?: Map<string, Row>;
    stage?: Map<string, Row>;
    lead?: Map<string, Row>;
    deal?: Map<string, Row>;
  }
): Row {
  const out: Row = { ...row };
  if (row.account_id && maps.account?.has(String(row.account_id))) {
    out.account_name = maps.account.get(String(row.account_id))?.name ?? null;
  }
  if (row.contact_id && maps.contact?.has(String(row.contact_id))) {
    const c = maps.contact.get(String(row.contact_id));
    out.contact_name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : null;
  }
  if (row.stage_id && maps.stage?.has(String(row.stage_id))) {
    const s = maps.stage.get(String(row.stage_id));
    out.stage_name = s?.name ?? null;
    out.stage_color = s?.color ?? null;
    out.stage_position = s?.position ?? null;
  }
  if (row.lead_id && maps.lead?.has(String(row.lead_id))) {
    out.lead_name = maps.lead.get(String(row.lead_id))?.name ?? null;
  }
  if (row.deal_id && maps.deal?.has(String(row.deal_id))) {
    out.deal_name = maps.deal.get(String(row.deal_id))?.name ?? null;
  }
  return out;
}

function isWon(row: Row): boolean {
  return Boolean(row.won_at) && !Boolean(row.lost_at);
}

function isLost(row: Row): boolean {
  return Boolean(row.lost_at);
}

function guard(
  capability: string
): (ctx: {
  isPlatformAdmin?: boolean;
  isElevated?: boolean;
  platformRole?: PlatformStaffRole | null;
} | null | undefined) => ReturnType<typeof apiError> | null {
  return (ctx) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, capability)) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    return null;
  };
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads", "platform.crm"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-crm",
    rateLimit: { limit: 90, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    const denied = guard("crm")(ctx);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource") || "overview";
    const sb = createAdminClient();

    /* ---- overview ---- */
    if (resource === "overview") {
      const [stagesRes, dealsRes, accountsRes, contactsRes, activitiesRes, templatesRes, leadsRes] =
        await Promise.all([
          sb.from("crm_pipeline_stages").select("*").order("position", { ascending: true }),
          sb.from("crm_deals").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(300),
          sb.from("crm_accounts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
          sb.from("crm_platform_contacts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
          sb.from("crm_platform_activities").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(150),
          sb.from("crm_email_templates").select("*").order("name", { ascending: true }),
          sb.from("contact_messages").select("id, name, company, email").order("created_at", { ascending: false }).limit(500),
        ]);
      for (const r of [stagesRes, dealsRes, accountsRes, contactsRes, activitiesRes, templatesRes, leadsRes]) {
        if (r.error) throw r.error;
      }

      const stages = (stagesRes.data ?? []) as Row[];
      const rawDeals = (dealsRes.data ?? []) as Row[];
      const accounts = (accountsRes.data ?? []) as Row[];
      const contacts = (contactsRes.data ?? []) as Row[];
      const activities = (activitiesRes.data ?? []) as Row[];
      const templates = (templatesRes.data ?? []) as Row[];
      const leads = (leadsRes.data ?? []) as Row[];

      const stageMap = mapById(stages);
      const accountMap = mapById(accounts);
      const contactMap = mapById(contacts);
      const leadMap = mapById(leads);
      const deals = rawDeals.map((d) =>
        decorateNames(d, { account: accountMap, contact: contactMap, stage: stageMap, lead: leadMap })
      );

      const open = deals.filter((d) => !isWon(d) && !isLost(d));
      const won = deals.filter(isWon);
      const lost = deals.filter(isLost);
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const wonValue30d = sum(won.filter((d) => now - new Date(String(d.won_at)).getTime() <= thirtyDays), "amount");
      const pipelineValue = sum(open, "amount");
      const weightedPipeline = open.reduce(
        (acc, d) => acc + (Number(d.amount) || 0) * ((Number(d.probability) || 0) / 100),
        0
      );
      const conversions = won.length + lost.length;
      const conversionRate = conversions ? Math.round((won.length / conversions) * 100) : 0;
      const avgDealSize = won.length ? Math.round(sum(won, "amount") / won.length) : 0;

      const openTasks = activities.filter((a) => !a.done && a.due_at);
      const overdue = openTasks.filter((a) => new Date(String(a.due_at)).getTime() < now);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const dueToday = openTasks.filter((a) => new Date(String(a.due_at)).getTime() <= todayEnd.getTime());

      const stats = {
        accounts_count: accounts.length,
        contacts_count: contacts.length,
        deals_count: deals.length,
        open_deals: open.length,
        won_deals: won.length,
        lost_deals: lost.length,
        pipeline_value: Math.round(pipelineValue),
        weighted_pipeline: Math.round(weightedPipeline),
        won_value_total: Math.round(sum(won, "amount")),
        won_value_30d: Math.round(wonValue30d),
        avg_deal_size: avgDealSize,
        conversion_rate: conversionRate,
        activities_count: activities.length,
        pending_tasks: openTasks.length,
        due_today: dueToday.length,
        overdue_tasks: overdue.length,
        templates_count: templates.length,
        deals_by_stage: countBy(deals.filter((d) => !isLost(d)), "stage_name"),
        activities_by_kind: countBy(activities, "kind"),
      };

      return apiOk({ stages, deals, accounts, contacts, activities, templates, leads: leads.slice(0, 100), stats });
    }

    /* ---- accounts ---- */
    if (resource === "accounts") {
      const search = searchParams.get("search")?.trim() || null;
      const status = searchParams.get("status") || null;
      const industry = searchParams.get("industry") || null;
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
      let q = sb.from("crm_accounts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,website.ilike.%${search}%`);
      if (status && ["prospect", "active", "churned"].includes(status)) q = q.eq("status", status);
      if (industry) q = q.eq("industry", industry);
      const { data, error } = await q;
      if (error) throw error;
      return apiOk({ accounts: data ?? [], count: (data ?? []).length });
    }

    /* ---- contacts ---- */
    if (resource === "contacts") {
      const search = searchParams.get("search")?.trim() || null;
      const accountId = searchParams.get("account_id") || null;
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
      let q = sb.from("crm_platform_contacts").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      const accounts = (await sb.from("crm_accounts").select("id, name").is("deleted_at", null).limit(500)).data ?? [];
      const accountMap = mapById(accounts as Row[]);
      const contacts = ((data ?? []) as Row[]).map((c) => decorateNames(c, { account: accountMap }));
      return apiOk({ contacts, count: contacts.length });
    }

    /* ---- deals ---- */
    if (resource === "deals") {
      const search = searchParams.get("search")?.trim() || null;
      const stageId = searchParams.get("stage_id") || null;
      const scope = searchParams.get("scope") || "open";
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
      let q = sb.from("crm_deals").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      if (search) q = q.ilike("name", `%${search}%`);
      if (stageId) q = q.eq("stage_id", stageId);
      if (scope === "open") q = q.is("won_at", null).is("lost_at", null);
      if (scope === "won") q = q.not("won_at", "is", null);
      if (scope === "lost") q = q.not("lost_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;

      const [stages, accounts, contacts, leads] = await Promise.all([
        sb.from("crm_pipeline_stages").select("*").order("position", { ascending: true }),
        sb.from("crm_accounts").select("id, name").is("deleted_at", null).limit(500),
        sb.from("crm_platform_contacts").select("id, first_name, last_name").is("deleted_at", null).limit(500),
        sb.from("contact_messages").select("id, name").limit(500),
      ]);
      const maps = {
        stage: mapById((stages.data ?? []) as Row[]),
        account: mapById((accounts.data ?? []) as Row[]),
        contact: mapById((contacts.data ?? []) as Row[]),
        lead: mapById((leads.data ?? []) as Row[]),
      };
      const deals = ((data ?? []) as Row[]).map((d) => decorateNames(d, maps));
      return apiOk({ deals, count: deals.length });
    }

    /* ---- activities ---- */
    if (resource === "activities") {
      const kind = searchParams.get("kind") || null;
      const done = searchParams.get("done");
      const due = searchParams.get("due") === "true";
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 100)));
      let q = sb.from("crm_platform_activities").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      if (kind && ["call", "meeting", "email", "note", "task", "follow_up", "system"].includes(kind)) q = q.eq("kind", kind);
      if (done === "true") q = q.eq("done", true);
      if (done === "false") q = q.eq("done", false);
      if (due) q = q.is("done", false).not("due_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;

      const [accounts, deals] = await Promise.all([
        sb.from("crm_accounts").select("id, name").is("deleted_at", null).limit(500),
        sb.from("crm_deals").select("id, name").is("deleted_at", null).limit(500),
      ]);
      const activities = ((data ?? []) as Row[]).map((a) =>
        decorateNames(a, {
          account: mapById((accounts.data ?? []) as Row[]),
          deal: mapById((deals.data ?? []) as Row[]),
        })
      );
      return apiOk({ activities, count: activities.length });
    }

    /* ---- templates ---- */
    if (resource === "templates") {
      const { data, error } = await sb.from("crm_email_templates").select("*").order("name", { ascending: true });
      if (error) throw error;
      return apiOk({ templates: data ?? [] });
    }

    /* ---- stages ---- */
    if (resource === "stages") {
      const { data, error } = await sb.from("crm_pipeline_stages").select("*").order("position", { ascending: true });
      if (error) throw error;
      return apiOk({ stages: data ?? [] });
    }

    return apiError("VALIDATION", "Unknown resource", 400);
  }
);
/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads", "platform.crm"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-crm",
    rateLimit: { limit: 120, windowMs: 60_000 },
    bodySchema: postSchema,
  },
  async ({ ctx, body }) => {
    const denied = guard("crm")(ctx);
    if (denied) return denied;
    const sb = createAdminClient();
    const actorId = ctx?.user.id || null;
    const actorLabel = ctx?.profile?.email || ctx?.user.email || "platform-staff";

    /* ---- accounts ---- */
    if (body.resource === "accounts") {
      const { data, error } = await sb
        .from("crm_accounts")
        .insert({ ...body.data, created_by: actorId, updated_by: actorId })
        .select()
        .single();
      if (error) throw error;
      return apiOk({ account: data }, { status: 201 });
    }

    /* ---- contacts ---- */
    if (body.resource === "contacts") {
      if (body.data.is_primary) {
        await sb.from("crm_platform_contacts").update({ is_primary: false }).eq("account_id", body.data.account_id);
      }
      const { data, error } = await sb
        .from("crm_platform_contacts")
        .insert({ ...body.data, created_by: actorId, updated_by: actorId })
        .select()
        .single();
      if (error) throw error;
      return apiOk({ contact: data }, { status: 201 });
    }

    /* ---- deals ---- */
    if (body.resource === "deals") {
      let stageId = body.data.stage_id;
      let probability = 0;
      if (!stageId) {
        const { data: firstStage } = await sb
          .from("crm_pipeline_stages")
          .select("id, probability")
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = String(firstStage?.id ?? "");
        probability = Number(firstStage?.probability) || 0;
      } else {
        const { data: stage } = await sb
          .from("crm_pipeline_stages")
          .select("probability")
          .eq("id", stageId)
          .maybeSingle();
        probability = Number(stage?.probability) || 0;
      }
      if (!stageId) return apiError("VALIDATION", "No pipeline stages configured", 400);

      const { data, error } = await sb
        .from("crm_deals")
        .insert({
          ...body.data,
          stage_id: stageId,
          probability,
          amount: body.data.amount ?? 0,
          currency: body.data.currency ?? "UGX",
          priority: body.data.priority ?? "medium",
          created_by: actorId,
          updated_by: actorId,
        })
        .select()
        .single();
      if (error) throw error;

      if (body.data.lead_id) {
        await sb.from("contact_messages").update({ deal_id: String(data.id) }).eq("id", body.data.lead_id);
      }
      await sb.from("crm_platform_activities").insert({
        kind: "system",
        subject: "Deal created",
        description: `Opportunity "${body.data.name}" created.`,
        account_id: body.data.account_id,
        contact_id: body.data.contact_id ?? null,
        deal_id: String(data.id),
        lead_id: body.data.lead_id ?? null,
        done: true,
        completed_at: new Date().toISOString(),
        created_by: actorId,
        updated_by: actorId,
      });
      return apiOk({ deal: data }, { status: 201 });
    }

    /* ---- activities ---- */
    if (body.resource === "activities") {
      const { data, error } = await sb
        .from("crm_platform_activities")
        .insert({
          ...body.data,
          kind: body.data.kind ?? "note",
          done: false,
          created_by: actorId,
          updated_by: actorId,
        })
        .select()
        .single();
      if (error) throw error;
      return apiOk({ activity: data }, { status: 201 });
    }

    /* ---- convert lead ---- */
    if (body.resource === "convert") {
      const { data: lead, error: leadError } = await sb
        .from("contact_messages")
        .select("id, name, email, phone, company, industry, country, company_size, source, message, status, account_id")
        .eq("id", body.data.lead_id)
        .maybeSingle();
      if (leadError) throw leadError;
      if (!lead) return apiError("NOT_FOUND", "Lead not found", 404);

      const leadRow = lead as Row;
      const accountName = String(leadRow.company?.toString().trim() || leadRow.name || "New Account");
      let accountId = body.data.account_id;

      if (!accountId) {
        const { data: existing } = await sb
          .from("crm_accounts")
          .select("id")
          .eq("name", accountName)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        accountId = String(existing?.id ?? "");
      }

      let createdAccount: Row | null = null;
      if (!accountId) {
        const { data: acct, error: acctError } = await sb
          .from("crm_accounts")
          .insert({
            name: accountName,
            industry: leadRow.industry ?? null,
            country: leadRow.country ?? null,
            size_band: leadRow.company_size ?? null,
            source: leadRow.source ?? null,
            email: leadRow.email ?? null,
            phone: leadRow.phone ?? null,
            description: leadRow.message ? `From lead: ${leadRow.message}`.slice(0, 4000) : null,
            lead_id: String(leadRow.id),
            created_by: actorId,
            updated_by: actorId,
          })
          .select()
          .single();
        if (acctError) throw acctError;
        accountId = String(acct.id);
        createdAccount = acct as Row;
      } else {
        await sb.from("crm_accounts").update({ lead_id: String(leadRow.id), updated_by: actorId }).eq("id", accountId);
      }

      const nameParts = String(leadRow.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "Contact";
      let contactId: string | null = null;
      const { data: existingContact } = await sb
        .from("crm_platform_contacts")
        .select("id")
        .eq("account_id", accountId)
        .eq("email", leadRow.email ?? "")
        .limit(1)
        .maybeSingle();
      if (existingContact) {
        contactId = String(existingContact.id);
      } else {
        const { data: contact, error: contactError } = await sb
          .from("crm_platform_contacts")
          .insert({
            account_id: accountId,
            first_name: firstName,
            last_name: lastName,
            email: leadRow.email ?? null,
            phone: leadRow.phone ?? null,
            source: leadRow.source ?? null,
            is_primary: true,
            created_by: actorId,
            updated_by: actorId,
          })
          .select()
          .single();
        if (contactError) throw contactError;
        contactId = String(contact.id);
      }

      const { data: firstStage } = await sb
        .from("crm_pipeline_stages")
        .select("id, name, probability")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: deal, error: dealError } = await sb
        .from("crm_deals")
        .insert({
          account_id: accountId,
          contact_id: contactId,
          name: `ERP - ${accountName}`.slice(0, 200),
          amount: 0,
          currency: "UGX",
          stage_id: String(firstStage?.id ?? ""),
          probability: Number(firstStage?.probability) || 0,
          source: leadRow.source ?? null,
          lead_id: String(leadRow.id),
          owner_id: body.data.owner_id ?? null,
          expected_close: null,
          created_by: actorId,
          updated_by: actorId,
        })
        .select()
        .single();
      if (dealError) throw dealError;

      await sb
        .from("contact_messages")
        .update({ status: "converted", account_id: accountId, deal_id: String(deal.id) })
        .eq("id", String(leadRow.id));

      await sb.from("crm_platform_activities").insert({
        kind: "system",
        subject: "Lead converted",
        description: `Lead converted into account "${accountName}" with a new pipeline opportunity.`,
        account_id: accountId,
        contact_id: contactId,
        deal_id: String(deal.id),
        lead_id: String(leadRow.id),
        done: true,
        completed_at: new Date().toISOString(),
        created_by: actorId,
        updated_by: actorId,
      });
      await sb.from("lead_activities").insert({
        lead_id: String(leadRow.id),
        action: "converted",
        note: `Converted to CRM account${createdAccount ? " (created)" : ""} and opportunity.`,
        actor: actorLabel,
      });

      return apiOk({ account_id: accountId, contact_id: contactId, deal, lead_id: String(leadRow.id) }, { status: 201 });
    }

    return apiError("VALIDATION", "Unknown resource", 400);
  }
);
/* ------------------------------------------------------------------ */
/* PATCH                                                               */
/* ------------------------------------------------------------------ */

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads", "platform.crm"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-crm",
    rateLimit: { limit: 150, windowMs: 60_000 },
    bodySchema: patchSchema,
  },
  async ({ ctx, body }) => {
    const denied = guard("crm")(ctx);
    if (denied) return denied;
    const sb = createAdminClient();
    const actorId = ctx?.user.id || null;

    /* ---- accounts ---- */
    if (body.resource === "accounts") {
      const { data, error } = await sb
        .from("crm_accounts")
        .update({ ...body.data, updated_by: actorId })
        .eq("id", body.id)
        .is("deleted_at", null)
        .select()
        .single();
      if (error) throw error;
      return apiOk({ account: data });
    }

    /* ---- contacts ---- */
    if (body.resource === "contacts") {
      if (body.data.is_primary) {
        const { data: existing } = await sb
          .from("crm_platform_contacts")
          .select("account_id")
          .eq("id", body.id)
          .maybeSingle();
        if (existing?.account_id) {
          await sb
            .from("crm_platform_contacts")
            .update({ is_primary: false })
            .eq("account_id", existing.account_id)
            .neq("id", body.id);
        }
      }
      const { data, error } = await sb
        .from("crm_platform_contacts")
        .update({ ...body.data, updated_by: actorId })
        .eq("id", body.id)
        .is("deleted_at", null)
        .select()
        .single();
      if (error) throw error;
      return apiOk({ contact: data });
    }

    /* ---- deals ---- */
    if (body.resource === "deals") {
      const { data: existing, error: fetchError } = await sb
        .from("crm_deals")
        .select("id, stage_id, amount, won_at, lost_at, name, account_id")
        .eq("id", body.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!existing) return apiError("NOT_FOUND", "Deal not found", 404);

      const updates: Row = { ...body.data, updated_by: actorId };
      let systemNote: string | null = null;

      if (body.data.stage_id && body.data.stage_id !== existing.stage_id) {
        const { data: stage } = await sb
          .from("crm_pipeline_stages")
          .select("name, probability, is_won, is_lost")
          .eq("id", body.data.stage_id)
          .maybeSingle();
        if (!stage) return apiError("NOT_FOUND", "Stage not found", 404);
        updates.probability = Number(stage.probability) || 0;
        if (stage.is_won) {
          updates.won_at = new Date().toISOString();
          updates.lost_at = null;
        } else if (stage.is_lost) {
          updates.lost_at = new Date().toISOString();
          updates.won_at = null;
        } else {
          updates.won_at = null;
          updates.lost_at = null;
        }
        systemNote = `Deal moved to ${stage.name}`;
      }

      const { data, error } = await sb
        .from("crm_deals")
        .update(updates)
        .eq("id", body.id)
        .is("deleted_at", null)
        .select()
        .single();
      if (error) throw error;

      if (systemNote) {
        await sb.from("crm_platform_activities").insert({
          kind: "system",
          subject: systemNote,
          description: systemNote,
          account_id: data.account_id,
          deal_id: String(data.id),
          done: true,
          completed_at: new Date().toISOString(),
          created_by: actorId,
          updated_by: actorId,
        });
      }
      return apiOk({ deal: data });
    }

    /* ---- activities ---- */
    if (body.resource === "activities") {
      const updates: Row = { ...body.data, updated_by: actorId };
      if (body.data.done !== undefined) {
        const { data: existing } = await sb
          .from("crm_platform_activities")
          .select("done")
          .eq("id", body.id)
          .maybeSingle();
        const wasDone = Boolean(existing?.done);
        if (body.data.done && !wasDone) updates.completed_at = new Date().toISOString();
        if (!body.data.done) updates.completed_at = null;
      }
      const { data, error } = await sb
        .from("crm_platform_activities")
        .update(updates)
        .eq("id", body.id)
        .is("deleted_at", null)
        .select()
        .single();
      if (error) throw error;
      return apiOk({ activity: data });
    }

    return apiError("VALIDATION", "Unknown resource", 400);
  }
);

/* ------------------------------------------------------------------ */
/* DELETE (soft delete)                                                */
/* ------------------------------------------------------------------ */

export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads", "platform.crm"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-crm",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    const denied = guard("crm")(ctx);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource");
    const id = searchParams.get("id");
    if (!resource || !["accounts", "contacts", "deals", "activities"].includes(resource)) {
      return apiError("VALIDATION", "Missing or invalid resource", 400);
    }
    if (!id || !z.string().uuid().safeParse(id).success) {
      return apiError("VALIDATION", "Missing or invalid id", 400);
    }

    const tableForResource: Record<string, string> = {
      accounts: "crm_accounts",
      contacts: "crm_platform_contacts",
      deals: "crm_deals",
      activities: "crm_platform_activities",
    };

    const sb = createAdminClient();
    const actorId = ctx?.user.id || null;
    const { error } = await sb
      .from(tableForResource[resource])
      .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;
    return apiOk({ id, deleted: true });
  }
);