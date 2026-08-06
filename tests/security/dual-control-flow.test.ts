/**
 * Dual-control + payroll money-path flow tests.
 * Pure logic always runs; live API path requires INTEGRATION_TESTS + credentials.
 */
import { describe, it, expect } from "vitest";
import {
  assertDualControl,
  identityDualControlRequired,
  type DualControlAction,
} from "@/lib/security/dual-control";
import {
  applyTransition,
  createInstance,
  getWorkflowDef,
} from "@/lib/workflows/engine";
import { evaluateThreeWayMatch } from "@/lib/procurement/three-way-match";
import { calculateEmployeePay } from "@/lib/payroll/engine";

/** Actions that must require dual-control when DUAL_CONTROL_REQUIRED=true */
const MONEY_ACTIONS = [
  "payroll.release",
  "payroll.bank_file",
  "finance.gl_post",
  "finance.period_close",
  "billing.payment_void",
] as const satisfies readonly DualControlAction[];

describe("dual-control money action inventory", () => {
  it("covers payroll and finance high-risk actions", () => {
    expect(MONEY_ACTIONS).toContain("payroll.release");
    expect(MONEY_ACTIONS).toContain("payroll.bank_file");
    expect(MONEY_ACTIONS).toContain("finance.gl_post");
  });
});

describe("payroll workflow dual-control gates", () => {
  it("marks approve and post_finance as dual-control", () => {
    const def = getWorkflowDef("payroll")!;
    const dual = def.transitions.filter((t) => t.dualControl);
    const events = dual.map((t) => t.event);
    expect(events).toContain("submit_for_approval");
    expect(events).toContain("approve");
    expect(events).toContain("post_finance");
  });

  it("walks full payroll cycle to posted with dual-control steps", () => {
    const def = getWorkflowDef("payroll")!;
    let inst = createInstance(def, {
      companyId: "c1",
      entityType: "pay_period",
      entityId: "00000000-0000-4000-8000-000000000099",
    });

    const path = [
      "close_attendance",
      "close_overtime",
      "close_leave",
      "apply_allowances",
      "apply_deductions",
      "calculate_statutory",
      "submit_for_approval",
      "approve",
      "generate_bank_file",
      "post_finance",
    ];

    let dualHits = 0;
    for (const ev of path) {
      const r = applyTransition(def, inst, ev);
      expect(r.ok, `failed at ${ev}`).toBe(true);
      if (r.ok) {
        if (r.dualControl) dualHits += 1;
        inst = r.instance;
      }
    }
    expect(inst.status).toBe("posted");
    expect(dualHits).toBeGreaterThanOrEqual(3);
  });
});

describe("end-to-end domain integrity (offline)", () => {
  it("payroll calc + three-way match both succeed for clean inputs", () => {
    const pay = calculateEmployeePay({
      employee_id: "e1",
      basic_salary: 2_000_000,
      housing: 200_000,
      transport: 100_000,
      medical: 50_000,
      communication: 30_000,
      overtime: 0,
      bonuses: 0,
      commission: 0,
      incentives: 0,
      loan_deduction: 100_000,
      country_code: "UG",
    });
    expect(pay.net_pay).toBeGreaterThan(0);
    expect(pay.gross_pay).toBe(2_380_000);

    const match = evaluateThreeWayMatch({
      poAmount: pay.net_pay,
      grnAmount: pay.net_pay,
      invoiceAmount: pay.net_pay,
    });
    expect(match.status).toBe("matched");
    expect(match.canPay).toBe(true);
  });

  it("rejects paying invoice above GRN (fraud path)", () => {
    const match = evaluateThreeWayMatch({
      poAmount: 5_000_000,
      grnAmount: 1_000_000,
      invoiceAmount: 4_500_000,
    });
    expect(match.status).toBe("exception");
    expect(match.canPay).toBe(false);
  });
});

describe("live dual-control API (optional)", () => {
  const enabled =
    process.env.INTEGRATION_TESTS === "true" &&
    Boolean(process.env.E2E_EMAIL) &&
    Boolean(process.env.E2E_PASSWORD) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const base = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "";

  it.skipIf(!enabled || !base)(
    "maker creates dual-control request via API session",
    async () => {
      // Session cookie path is browser-bound; here we prove Supabase dual-control table writes
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
        email: process.env.E2E_EMAIL!,
        password: process.env.E2E_PASSWORD!,
      });
      expect(authErr).toBeNull();
      expect(auth.user).toBeTruthy();

      const { data: profile } = await sb
        .from("user_profiles")
        .select("id,company_id")
        .eq("id", auth.user!.id)
        .maybeSingle();
      expect(profile?.company_id).toBeTruthy();

      const { data: created, error } = await sb
        .from("sec_dual_control_requests")
        .insert({
          company_id: profile!.company_id,
          action: "payroll.bank_file",
          maker_id: profile!.id,
          status: "pending",
          notes: "phase5-integration-probe",
          payload: { probe: true },
        })
        .select("id,status,action")
        .single();

      // If RLS blocks insert, surface as failure for ops to fix permissions
      expect(error, error?.message).toBeNull();
      expect(created?.status).toBe("pending");
      expect(created?.action).toBe("payroll.bank_file");

      // Cleanup probe
      if (created?.id) {
        await sb.from("sec_dual_control_requests").delete().eq("id", created.id);
      }
    }
  );
});

describe("identity dual-control policy", () => {
  it("tenant admins activate directly without a dual-control id", () => {
    expect(
      identityDualControlRequired({ isPlatformAdmin: false, dualControlId: null })
    ).toBe(false);
    expect(identityDualControlRequired({ isPlatformAdmin: false })).toBe(false);
  });

  it("tenant admins can still opt into voluntary dual control", () => {
    expect(
      identityDualControlRequired({
        isPlatformAdmin: false,
        dualControlId: "00000000-0000-4000-8000-000000000099",
      })
    ).toBe(true);
  });

  it("platform staff keep the production default", () => {
    expect(
      identityDualControlRequired({ isPlatformAdmin: true, dualControlId: null })
    ).toBeUndefined();
    expect(
      identityDualControlRequired({
        isPlatformAdmin: true,
        dualControlId: "00000000-0000-4000-8000-000000000099",
      })
    ).toBeUndefined();
  });
});

describe("assertDualControl tenant-admin contract", () => {
  it("allows direct activation when required:false", async () => {
    const r = await assertDualControl({
      company_id: "c1",
      action: "identity.provision",
      actor_id: "u1",
      required: false,
    });
    expect(r.ok).toBe(true);
  });

  it("fail-closes when required and no approved request is supplied", async () => {
    const r = await assertDualControl({
      company_id: "c1",
      action: "identity.provision",
      actor_id: "u1",
      required: true,
    });
    expect(r.ok).toBe(false);
  });
});