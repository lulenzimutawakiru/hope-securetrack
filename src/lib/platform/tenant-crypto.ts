/**
 * Per-tenant crypto material for data-at-rest isolation.
 * Raw keys are returned only once at provision time for vaulting —
 * the database stores key_id + fingerprint only (never the secret).
 */

import { createHash, randomBytes, randomUUID } from "crypto";

export type TenantCryptoMaterial = {
  key_id: string;
  fingerprint: string;
  /** Base64 256-bit key — return once at create; do not re-expose */
  secret_b64: string;
  algorithm: "AES-256-GCM";
};

export function generateTenantEncryptionKey(): TenantCryptoMaterial {
  const key_id = randomUUID();
  const secret = randomBytes(32);
  const fingerprint = createHash("sha256").update(secret).digest("hex");
  return {
    key_id,
    fingerprint,
    secret_b64: secret.toString("base64"),
    algorithm: "AES-256-GCM",
  };
}

export function tenantDomainFromSlug(slug: string): string {
  const base =
    process.env.SECURETRACK_TENANT_DOMAIN_BASE?.replace(/^\./, "") ||
    "securetrack.com";
  const clean = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/g, "");
  return `${clean || "tenant"}.${base}`;
}

export type TenantComplianceCode =
  | "gdpr"
  | "iso27001"
  | "soc2"
  | "hipaa"
  | "pci_dss"
  | "government"
  | "local_data_residency";

export type TenantEnterpriseConfig = {
  industry?: string | null;
  language?: string;
  data_region?: string;
  domain?: string;
  compliance_requirements?: TenantComplianceCode[];
  encryption?: {
    key_id: string;
    fingerprint: string;
    algorithm: string;
  };
  isolation?: {
    enforce_tenant_id: boolean;
    enforce_company_id: boolean;
    enforce_branch_id: boolean;
    rls: boolean;
    storage: boolean;
    search: boolean;
    ai: boolean;
    reporting: boolean;
  };
};
