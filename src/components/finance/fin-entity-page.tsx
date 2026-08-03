"use client";

/**
 * Finance EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type FinFieldDef = SecureFieldDef;
export type FinEntityConfig = SecureEntityConfig;

export function FinEntityPage({ config }: { config: FinEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
      }}
    />
  );
}
