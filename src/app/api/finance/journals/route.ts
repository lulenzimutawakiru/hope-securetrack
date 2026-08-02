import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import { assertDualControl } from "@/lib/security/dual-control";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const lineSchema = z.object({
  account_id: z.string().uuid(),
  cost_center_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
});

const schema = z.object({
  journal_type: z.string().min(1).max(40).default("general"),
  journal_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "journal_date must be YYYY-MM-DD")
    .optional(),
  description: z.string().max(500).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  lines: z.array(lineSchema).min(1).max(500),
  dual_control_id: z.string().uuid().optional().nullable(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Create a general journal with balanced lines (money path).
 *
 * Runs with the admin client so the journal + lines write atomically.
 * The journal is created as a draft; posting remains a separate,
 * dual-controlled operation. Debits must equal credits.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["finance.post", "finance.manage", "finance.admin", "finance.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `finance-journals:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const dc = await assertDualControl({
    company_id: auth.ctx.companyId,
    action: "finance.gl_create",
    actor_id: auth.ctx.user.id,
    request_id: parsed.data.dual_control_id,
    required: Boolean(parsed.data.dual_control_id) || false,
  });
  if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of parsed.data.lines) {
    if (line.debit > 0 && line.credit > 0) {
      return apiError(
        "VALIDATION",
        "A journal line cannot have both debit and credit",
        400
      );
    }
    if (line.debit === 0 && line.credit === 0) {
      return apiError("VALIDATION", "A journal line must have a debit or credit", 400);
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    return apiError(
      "VALIDATION",
      `Journal is not balanced: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`,
      400
    );
  }

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { count, error: countErr } = await admin
      .from("gl_journals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (countErr) return apiError("INTERNAL", countErr.message, 500);

    const y = new Date().getFullYear();
    const journalNumber = `GL-${y}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: journal, error: jErr } = await admin
      .from("gl_journals")
      .insert({
        company_id: companyId,
        journal_number: journalNumber,
        journal_type: parsed.data.journal_type,
        journal_date: parsed.data.journal_date ?? new Date().toISOString().slice(0, 10),
        currency: "UGX",
        description: parsed.data.description ?? null,
        reference: parsed.data.reference ?? null,
        status: "draft",
        total_debit: totalDebit,
        total_credit: totalCredit,
        created_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (jErr || !journal) {
      return apiError("INTERNAL", jErr?.message ?? "Failed to create journal", 500);
    }

    const lines = parsed.data.lines.map((l, i) => ({
      journal_id: journal.id,
      company_id: companyId,
      line_number: i + 1,
      account_id: l.account_id,
      cost_center_id: l.cost_center_id ?? null,
      description: l.description ?? null,
      debit: round2(l.debit),
      credit: round2(l.credit),
    }));
    const { error: linesErr } = await admin.from("gl_journal_lines").insert(lines);
    if (linesErr) {
      await admin.from("gl_journals").delete().eq("id", journal.id);
      return apiError("INTERNAL", linesErr.message, 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "finance.journal_created",
      module: "finance",
      entity_type: "gl_journals",
      entity_id: journal.id,
      entity_reference: journalNumber,
      after_state: {
        journal_number: journalNumber,
        total_debit: totalDebit,
        total_credit: totalCredit,
        line_count: lines.length,
      },
      metadata: { source: "api/finance/journals" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ journal, line_count: lines.length }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Journal creation failed",
      500
    );
  }
}
