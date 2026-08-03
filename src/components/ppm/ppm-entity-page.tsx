"use client";

/**
 * PPM EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type PpmFieldDef = SecureFieldDef;
export type PpmEntityConfig = SecureEntityConfig;

export function PpmEntityPage({ config }: { config: PpmEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
      }}
    />
  );
}
