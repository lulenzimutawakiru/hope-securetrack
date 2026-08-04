/**
 * Object storage path isolation — always tenant/company first.
 * Use for every upload/download path construction.
 */

import type { TenantScope } from "@/lib/tenant/context";
import { tenantStoragePrefix } from "@/lib/tenant/context";

const UNSAFE_SEGMENT = /[/\\]|\.\.|[\x00-\x1f]/;

/**
 * Build a storage object path under tenant/company.
 * Rejects path traversal and absolute segments.
 */
export function buildIsolatedStoragePath(
  scope: TenantScope,
  ...parts: string[]
): string {
  const safe = parts.map((p) => {
    const s = String(p ?? "").replace(/^\/+/, "").trim();
    if (!s || UNSAFE_SEGMENT.test(s)) {
      throw new Error(`Unsafe storage path segment: ${p}`);
    }
    return s;
  });
  return tenantStoragePrefix(scope, ...safe);
}

/**
 * Validate an existing path belongs to the active scope.
 * Paths must start with `{tenantId|shared}/{companyId}/`.
 */
export function assertStoragePathInScope(
  scope: TenantScope,
  objectPath: string
): void {
  if (scope.isElevated) return;
  const path = String(objectPath || "").replace(/^\/+/, "");
  const prefix = tenantStoragePrefix(scope);
  if (!path.startsWith(prefix + "/") && path !== prefix) {
    throw new Error(
      `Storage path outside tenant/company boundary: expected prefix ${prefix}`
    );
  }
  if (path.includes("..") || path.includes("\\")) {
    throw new Error("Storage path contains illegal sequences");
  }
}

/**
 * Parse tenant + company from a well-formed storage path.
 */
export function parseStoragePath(
  objectPath: string
): { tenantId: string; companyId: string; rest: string } | null {
  const parts = String(objectPath || "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 2) return null;
  return {
    tenantId: parts[0],
    companyId: parts[1],
    rest: parts.slice(2).join("/"),
  };
}

/** Allowed public buckets that may use non-tenant prefixes (explicit list). */
export const PUBLIC_STORAGE_BUCKETS = new Set([
  "avatars", // profile images still should prefer company prefix when possible
]);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_STORAGE_BUCKETS.has(bucket);
}
