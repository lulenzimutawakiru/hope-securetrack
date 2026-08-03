"use client";

/**
 * Payroll EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type PayFieldDef = SecureFieldDef;
export type PayEntityConfig = SecureEntityConfig;

export function PayEntityPage({ config }: { config: PayEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
        allowShowDeleted: config.allowShowDeleted ?? true,
      }}
    />
  );
}
