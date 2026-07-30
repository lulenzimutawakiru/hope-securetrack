import { describe, it, expect } from "vitest";
import {
  parseCsv,
  validateImportRows,
  toCsv,
} from "@/lib/enterprise/csv";
import {
  applyTransition,
  createInstance,
  getWorkflowDef,
  getAllowedEvents,
  WORKFLOW_DEFS,
} from "@/lib/workflows/engine";
import {
  hashToken,
  verifyTokenHash,
  generateSecureToken,
} from "@/lib/security/tokens";
import { ruleBasedAssist } from "@/lib/ai/gateway";

describe("CSV import", () => {
  it("parses headers and rows", () => {
    const csv = `name,amount\nAlice,100\nBob,"1,200"\n`;
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["name", "amount"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].name).toBe("Alice");
  });

  it("validates required fields and numbers", () => {
    const { valid, invalid } = validateImportRows(
      [
        { name: "Alice", amount: "100" },
        { name: "", amount: "x" },
      ],
      {
        columns: { name: "name", amount: "amount" },
        required: ["name"],
        numberFields: ["amount"],
      }
    );
    expect(valid).toHaveLength(1);
    expect(valid[0].amount).toBe(100);
    expect(invalid.length).toBeGreaterThanOrEqual(1);
  });

  it("round-trips toCsv", () => {
    const out = toCsv([{ a: 1, b: 'x,"y"' }], ["a", "b"]);
    expect(out.split("\n")[0]).toBe("a,b");
    expect(out).toContain("1");
  });
});

describe("workflow engine", () => {
  it("exposes recruitment and payroll definitions", () => {
    expect(WORKFLOW_DEFS.recruitment).toBeTruthy();
    expect(WORKFLOW_DEFS.payroll).toBeTruthy();
    expect(getWorkflowDef("procurement")?.initial).toBe("requisition");
  });

  it("advances payroll from attendance through overtime", () => {
    const def = getWorkflowDef("payroll")!;
    let inst = createInstance(def, {
      companyId: "c1",
      entityType: "pay_period",
      entityId: "00000000-0000-0000-0000-000000000001",
    });
    expect(inst.status).toBe("attendance");
    const r1 = applyTransition(def, inst, "close_attendance");
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      inst = r1.instance;
      expect(inst.status).toBe("overtime");
    }
  });

  it("rejects invalid events and lists allowed", () => {
    const def = getWorkflowDef("procurement")!;
    const inst = createInstance(def, {
      companyId: "c1",
      entityType: "pr",
      entityId: "00000000-0000-0000-0000-000000000002",
    });
    const bad = applyTransition(def, inst, "pay");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.allowedEvents?.length).toBeGreaterThan(0);
    }
  });

  it("flags dual-control on payroll approval", () => {
    const def = getWorkflowDef("payroll")!;
    let inst = createInstance(def, {
      companyId: "c1",
      entityType: "pay_period",
      entityId: "00000000-0000-0000-0000-000000000003",
    });
    const steps = [
      "close_attendance",
      "close_overtime",
      "close_leave",
      "apply_allowances",
      "apply_deductions",
      "calculate_statutory",
      "submit_for_approval",
    ];
    for (const ev of steps) {
      const r = applyTransition(def, inst, ev);
      expect(r.ok).toBe(true);
      if (r.ok) inst = r.instance;
    }
    const approve = applyTransition(def, inst, "approve");
    expect(approve.ok).toBe(true);
    if (approve.ok) {
      expect(approve.dualControl).toBe(true);
      expect(approve.to).toBe("bank_file");
    }
  });

  it("lists allowed events for manufacturing start", () => {
    const def = getWorkflowDef("manufacturing")!;
    const events = getAllowedEvents(def, "sales_order").map((t) => t.event);
    expect(events).toContain("plan");
  });
});

describe("token hashing", () => {
  it("hashes and verifies", async () => {
    const token = generateSecureToken(16);
    expect(token.length).toBe(32);
    const hash = await hashToken(token);
    expect(hash).toHaveLength(64);
    expect(await verifyTokenHash(token, hash)).toBe(true);
    expect(await verifyTokenHash("wrong", hash)).toBe(false);
  });
});

describe("AI rules assistant", () => {
  it("returns payroll checklist", () => {
    const reply = ruleBasedAssist(
      [{ role: "user", content: "How do I process payroll?" }],
      "payroll"
    );
    expect(reply.toLowerCase()).toContain("payroll");
    expect(reply).toMatch(/attendance|approval|bank/i);
  });
});
