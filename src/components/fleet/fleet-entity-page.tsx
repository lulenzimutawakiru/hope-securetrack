"use client";

/**
 * Fleet EntityPage — thin wrapper over SecureEntityPage.
 * All CRUD goes through /api/v2/crud (server-scoped, permissioned, audited).
 */

import {
  SecureEntityPage,
  type SecureEntityConfig,
  type SecureFieldDef,
} from "@/components/enterprise/secure-entity-page";

export type FleetFieldDef = SecureFieldDef;
export type FleetEntityConfig = SecureEntityConfig;

export function FleetEntityPage({ config }: { config: FleetEntityConfig }) {
  return (
    <SecureEntityPage
      config={{
        ...config,
        entity: config.entity || config.table,
      }}
    />
  );
}
