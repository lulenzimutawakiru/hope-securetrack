import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCustomersKyc } from "../client";
import {
  describeMadapiError,
  isMadapiSuccessCode,
  resolveMadapiCode,
} from "../madapi-codes";

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
    expect(res.madapiCode).toBe("0000");
    expect(res.body.transactionId).toBe("txn-test-1");
    expect(res.body.customers?.length).toBe(2);
    expect(res.body.customers?.[0].bvn).toBe("BVN123455");
  });

  it("rejects empty identifiers with MADAPI 5000", async () => {
    const res = await verifyCustomersKyc({
      transactionId: "txn-empty",
      bvns: [],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.madapiCode).toBe("5000");
    expect(res.status).toBe(400);
  });
});

describe("MADAPI status codes (swagger)", () => {
  it("maps HTTP statuses to swagger MADAPI examples", () => {
    expect(resolveMadapiCode(400, null)).toBe("5000");
    expect(resolveMadapiCode(401, null)).toBe("4000");
    expect(resolveMadapiCode(403, null)).toBe("4001");
    expect(resolveMadapiCode(404, null)).toBe("1000");
    expect(resolveMadapiCode(405, null)).toBe("3000");
    expect(resolveMadapiCode(406, null)).toBe("3000");
    expect(resolveMadapiCode(415, null)).toBe("3000");
  });

  it("prefers body statusCode from ErrorPayload", () => {
    expect(resolveMadapiCode(403, { statusCode: "4001" })).toBe("4001");
    expect(resolveMadapiCode(400, { statusCode: "5000" })).toBe("5000");
    expect(resolveMadapiCode(404, { statusCode: "1000" })).toBe("1000");
    expect(resolveMadapiCode(405, { statusCode: "3000" })).toBe("3000");
  });

  it("describes Forbidden 4001 and Method Not Allowed 3000", () => {
    const d = describeMadapiError(403, {
      statusCode: "4001",
      statusMessage: "Access denied",
    });
    expect(d.code).toBe("4001");
    expect(d.severity).toBe("auth");
    expect(d.message).toMatch(/4001|Forbidden|Access denied/i);

    const m = describeMadapiError(405, { statusCode: "3000" });
    expect(m.code).toBe("3000");
    expect(m.severity).toBe("client");
  });

  it("treats 0000 as success", () => {
    expect(isMadapiSuccessCode("0000")).toBe(true);
    expect(isMadapiSuccessCode("1000")).toBe(false);
    expect(isMadapiSuccessCode("3000")).toBe(false);
    expect(isMadapiSuccessCode("4000")).toBe(false);
    expect(isMadapiSuccessCode("5000")).toBe(false);
  });
});
