import { describe, expect, it } from "vitest";
import {
  needsLoginMfaChallenge,
  mfaEnforcementEnabled,
} from "@/lib/security/mfa";

describe("MFA helpers", () => {
  it("detects login step-up when AAL1 and verified factors exist", () => {
    expect(
      needsLoginMfaChallenge({
        hasVerifiedFactor: true,
        aal: { currentLevel: "aal1", nextLevel: "aal2" },
      })
    ).toBe(true);
  });

  it("does not require step-up when already AAL2", () => {
    expect(
      needsLoginMfaChallenge({
        hasVerifiedFactor: true,
        aal: { currentLevel: "aal2", nextLevel: "aal2" },
      })
    ).toBe(false);
  });

  it("does not require step-up when no factors", () => {
    expect(
      needsLoginMfaChallenge({
        hasVerifiedFactor: false,
        aal: { currentLevel: "aal1", nextLevel: "aal1" },
      })
    ).toBe(false);
  });

  it("reads MFA_ENFORCE_PRIVILEGED from env", () => {
    // Function is pure-ish env reader; just ensure it returns a boolean
    expect(typeof mfaEnforcementEnabled()).toBe("boolean");
  });
});
