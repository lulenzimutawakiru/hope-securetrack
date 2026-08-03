import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { assertDualControl } from "@/lib/security/dual-control";
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

/** Create a balanced general journal draft (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "finance.post",
      "finance.manage",
      "finance.admin",
      "finance.approve",
    ],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "finance",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "finance.gl_create",
      actor_id: ctx.user.id,
      request_id: data.dual_control_id,
      required: Boolean(data.dual_control_id) || false,
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of data.lines) {
      if (line.debit > 0 && line.credit > 0) {
        return apiError(
          "VALIDATION",
          "A journal line cannot have both debit and credit",
          400
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        return apiError(
          "VALIDATION",
          "A journal line must have a debit or credit",
          400
        );
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
    const companyId = ctx.companyId;

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
          journal_type: data.journal_type,
          journal_date:
            data.journal_date ?? new Date().toISOString().slice(0, 10),
          currency: "UGX",
          description: data.description ?? null,
          reference: data.reference ?? null,
          status: "draft",
          total_debit: totalDebit,
          total_credit: totalCredit,
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (jErr || !journal) {
        return apiError(
          "INTERNAL",
          jErr?.message ?? "Failed to create journal",
          500
        );
      }

      const lines = data.lines.map((l, i) => ({
        journal_id: journal.id,
        company_id: companyId,
        line_number: i + 1,
        account_id: l.account_id,
        cost_center_id: l.cost_center_id ?? null,
        description: l.description ?? null,
        debit: round2(l.debit),
        credit: round2(l.credit),
      }));
      const { error: linesErr } = await admin
        .from("gl_journal_lines")
        .insert(lines);
      if (linesErr) {
        await admin.from("gl_journals").delete().eq("id", journal.id);
        return apiError("INTERNAL", linesErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
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
);
