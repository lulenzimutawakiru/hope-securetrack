import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkMsisdnActive,
  getIdentityStatus,
  verifyBiometric,
  verifyAddressScore,
  verifyCustomerSingle,
  verifyCustomersKyc,
  verifyCustomersKycPost,
  verifyKycScore,
  verifyNameScore,
} from "../client";
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

describe("MTN KYC POST /customers sandbox", () => {
  it("wraps customer array as bvns[] and returns mock matches", async () => {
    const res = await verifyCustomersKycPost({
      transactionId: "txn-post-1",
      targetSystem: "NIBSS",
      requestType: "FACE_MATCH",
      customers: [
        {
          msisdn: "2348012345678",
          firstName: "Joe",
          lastName: "Doe",
          faceImage: "aGVsbG8=",
        },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body.customers?.[0].firstName).toBe("Joe");
    expect(res.body.customers?.[0].matchStatus).toBe("BIOMETRIC_MATCH");
  });
});

describe("MTN KYC remaining swagger endpoints sandbox", () => {
  it("verify single customer (POST /customers/{id})", async () => {
    const res = await verifyCustomerSingle({
      transactionId: "txn-single-1",
      customerId: "2348064816499",
      isConsentVerified: true,
      body: { firstName: "Joe", lastName: "Doe" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.body.data).toMatchObject({ customerId: "2348064816499" });
  });

  it("check MSISDN active (GET /customers/{id})", async () => {
    const res = await checkMsisdnActive({
      transactionId: "txn-check-1",
      customerId: "2348064816499",
      verificationType: "BANK",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.data).toMatchObject({ verificationStatus: "Active" });
    }
  });

  it("score endpoints return 100% matches", async () => {
    for (const fn of [verifyKycScore, verifyNameScore, verifyAddressScore]) {
      const res = await fn({
        transactionId: "txn-score-1",
        customerId: "2348064816499",
        body: { firstName: "Joe" },
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect((res.body.data as { score: number }).score).toBe(100);
    }
  });

  it("biometric verify returns MATCH_FOUND", async () => {
    const res = await verifyBiometric({
      transactionId: "txn-bio-1",
      customerId: "2348064816499",
      body: { binaryAttachment: [{ content: "aGVsbG8=" }] },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.body.data as { matchDescription: string }).matchDescription).toBe("MATCH_FOUND");
    }
  });

  it("identity status returns enrollment status", async () => {
    const res = await getIdentityStatus({
      transactionId: "txn-id-1",
      body: { customerId: "8606165224086", agentId: "AG-1", channelId: "WEB" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.data).toMatchObject({ customerId: "8606165224086" });
    }
  });
});