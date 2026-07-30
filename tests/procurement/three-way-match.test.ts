import { describe, it, expect } from "vitest";
import { evaluateThreeWayMatch } from "@/lib/procurement/three-way-match";

describe("three-way match", () => {
  it("matches equal PO, GRN, invoice", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 1_000_000,
      grnAmount: 1_000_000,
      invoiceAmount: 1_000_000,
    });
    expect(r.status).toBe("matched");
    expect(r.canPay).toBe(true);
    expect(r.withinTolerance).toBe(true);
  });

  it("flags missing GRN as exception", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 500_000,
      grnAmount: 0,
      invoiceAmount: 500_000,
    });
    expect(r.status).toBe("exception");
    expect(r.canPay).toBe(false);
  });

  it("rejects invoice over GRN", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 1_000_000,
      grnAmount: 400_000,
      invoiceAmount: 900_000,
    });
    expect(r.status).toBe("exception");
    expect(r.canPay).toBe(false);
  });

  it("allows partial when invoice covered by GRN under PO", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 1_000_000,
      grnAmount: 600_000,
      invoiceAmount: 600_000,
    });
    expect(r.status).toBe("partial");
    expect(r.canPay).toBe(true);
  });

  it("rejects invoice over PO beyond tolerance", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 100_000,
      grnAmount: 120_000,
      invoiceAmount: 120_000,
      absoluteTolerance: 1,
      relativeTolerance: 0.005,
    });
    expect(r.status).toBe("exception");
  });

  it("accepts tiny variance within absolute tolerance", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 100_000,
      grnAmount: 100_000,
      invoiceAmount: 100_000.5,
      absoluteTolerance: 1,
    });
    expect(r.status).toBe("matched");
    expect(r.canPay).toBe(true);
  });

  it("pending when invoice is zero", () => {
    const r = evaluateThreeWayMatch({
      poAmount: 50_000,
      grnAmount: 50_000,
      invoiceAmount: 0,
    });
    expect(r.status).toBe("pending");
  });
});
