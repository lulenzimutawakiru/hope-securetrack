import { describe, it, expect } from "vitest";
import { defaultDomainEventHandlers } from "@/lib/jobs/domain-events";

describe("defaultDomainEventHandlers", () => {
  it("registers payroll and invoice handlers", () => {
    const h = defaultDomainEventHandlers();
    expect(typeof h["payroll.released"]).toBe("function");
    expect(typeof h["invoice.paid"]).toBe("function");
    expect(typeof h["security.dual_control.approved"]).toBe("function");
  });
});
