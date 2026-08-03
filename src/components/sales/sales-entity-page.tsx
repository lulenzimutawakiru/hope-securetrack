"use client";

/**
 * Sales EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type SalesFieldDef = SecureFieldDef;
export type SalesEntityConfig = SecureEntityConfig;

export function SalesEntityPage({ config }: { config: SalesEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
      }}
    />
  );
}
