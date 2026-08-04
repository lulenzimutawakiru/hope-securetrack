import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCustomersKyc } from "../client";

describe("MTN KYC client sandbox", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.MTN_KYC_SANDBOX = "true";
    delete process.env.MTN_KYC_API_KEY;
    delete process.env.MTN_KYC_BASIC_USER;
    delete process.env.MTN_KYC_BASIC_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns mock customers for BVNs without live credentials", async () => {
    const res = await verifyCustomersKyc({
      transactionId: "txn-test-1",
      targetSystem: "NIBSS",
      bvns: ["BVN123455", "BVN3409394"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body.transactionId).toBe("txn-test-1");
    expect(res.body.customers?.length).toBe(2);
    expect(res.body.customers?.[0].bvn).toBe("BVN123455");
  });

  it("rejects empty identifiers", async () => {
    const res = await verifyCustomersKyc({
      transactionId: "txn-empty",
      bvns: [],
    });
    expect(res.ok).toBe(false);
  });
});
