"use client";

/**
 * MES EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type FieldDef = SecureFieldDef;
export type MesEntityConfig = SecureEntityConfig;

export function MesEntityPage({ config }: { config: MesEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
      }}
    />
  );
}
