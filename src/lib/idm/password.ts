import type { PasswordPolicy } from "./types";

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_password_length: 10,
  require_uppercase: true,
  require_number: true,
  require_special: true,
  password_history_count: 5,
  password_expiry_days: 90,
  max_failed_logins: 5,
  lockout_minutes: 30,
  force_reset_on_first_login: true,
  temp_password_hours: 48,
};

export function validatePassword(
  password: string,
  policy: Partial<PasswordPolicy> = {}
): { valid: boolean; errors: string[] } {
  const p = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  const errors: string[] = [];
  if (password.length < p.min_password_length) {
    errors.push(`Minimum length is ${p.min_password_length}`);
  }
  if (p.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push("Must include an uppercase letter");
  }
  if (p.require_number && !/[0-9]/.test(password)) {
    errors.push("Must include a number");
  }
  if (p.require_special && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Must include a special character");
  }
  return { valid: errors.length === 0, errors };
}

/** Temporary password: HDG-Temp-XXXX-#### */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let body = "";
  for (let i = 0; i < 10; i++) {
    body += chars[Math.floor(Math.random() * chars.length)];
  }
  return `HDG-${body}!1A`;
}

export function passwordExpiresAt(policy: Partial<PasswordPolicy> = {}): Date {
  const days = policy.password_expiry_days ?? 90;
  return new Date(Date.now() + days * 864e5);
}

export function simpleHashHint(password: string): string {
  // Not cryptographic — audit/history marker only (real auth uses Supabase)
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = (Math.imul(31, h) + password.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(h).toString(16)}`;
}
