/**
 * Platform cPanel - Leads & CRM (SecureTrack staff only).
 *
 * GET  - list marketing leads with pipeline filters + analytics breakdown
 * PATCH - move a lead through the pipeline, assign ownership, schedule
 *         follow-up, or add an activity note
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(2000).optional(),
});

function countBy(rows: Array<Record<string, unknown>>, key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const v = row[key] == null || row[key] === "" ? "Unknown" : String(row[key]);
    out[v] = (out[v] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-leads",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "leads")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || null;
    const status = searchParams.get("status") || null;
    const industry = searchParams.get("industry") || null;
    const country = searchParams.get("country") || null;
    const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit") || 500)));

    const sb = createAdminClient();
    let query = sb
      .from("contact_messages")
      .select(
        "id, name, email, phone, company, industry, country, company_size, preferred_contact_method, message, source, status, lead_score, follow_up_at, assigned_to, attachment_path, metadata, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
      );
    }
    if (status && LEAD_STATUSES.includes(status as never)) {
      query = query.eq("status", status);
    }
    if (industry) query = query.eq("industry", industry);
    if (country) query = query.eq("country", country);

    const { data: rows, error } = await query;
    if (error) throw error;

    const leads = rows ?? [];
    const stats = {
      total: leads.length,
      by_status: countBy(leads, "status"),
      by_industry: countBy(leads, "industry"),
      by_country: countBy(leads, "country"),
      by_source: countBy(leads, "source"),
      by_company_size: countBy(leads, "company_size"),
      avg_lead_score: leads.length
        ? Math.round(
            leads.reduce((sum, l) => sum + (Number(l.lead_score) || 0), 0) / leads.length
          )
        : 0,
      pending_follow_ups: leads.filter(
        (l) => l.follow_up_at && new Date(l.follow_up_at as string) > new Date()
      ).length,
    };

    return apiOk({ leads, stats, count: leads.length });
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.leads"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-leads",
    rateLimit: { limit: 120, windowMs: 60_000 },
    bodySchema: patchSchema,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "leads")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }

    const actor = ctx.profile?.email || ctx.user?.email || "platform-staff";
    const sb = createAdminClient();

    const { data: existing, error: fetchError } = await sb
      .from("contact_messages")
      .select("id, status, assigned_to, follow_up_at")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return apiError("NOT_FOUND", "Lead not found", 404);
    }

    const updates: Record<string, unknown> = {};
    const activityNote: string[] = [];

    if (body.status && body.status !== existing.status) {
      updates.status = body.status;
      activityNote.push(`Status changed from ${existing.status} to ${body.status}`);
    }
    if (body.assignedTo !== undefined && body.assignedTo !== existing.assigned_to) {
      updates.assigned_to = body.assignedTo;
      activityNote.push(
        body.assignedTo ? "Lead assigned" : "Assignment removed"
      );
    }
    if (body.followUpAt !== undefined && body.followUpAt !== existing.follow_up_at) {
      updates.follow_up_at = body.followUpAt;
      activityNote.push(
        body.followUpAt ? "Follow-up scheduled" : "Follow-up cleared"
      );
    }

    if (Object.keys(updates).length) {
      const { error: updateError } = await sb
        .from("contact_messages")
        .update(updates)
        .eq("id", body.id);
      if (updateError) throw updateError;
    }

    const note =
      body.note?.trim() || (activityNote.length ? activityNote.join("; ") : null);
    if (note) {
      const { error: activityError } = await sb.from("lead_activities").insert({
        lead_id: body.id,
        action: body.status && body.status !== existing.status ? "status_changed" : "note_added",
        note,
        actor,
      });
      if (activityError) throw activityError;
    }

    return apiOk({ id: body.id });
  }
);