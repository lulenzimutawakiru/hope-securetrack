"use client";

import { FleetEntityPage } from "@/components/fleet/fleet-entity-page";
import { FLEET_ENTITIES } from "@/lib/fleet/entities";

export default function Page() {
  const config = FLEET_ENTITIES["fuel-consumption"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: fuel-consumption</div>;
  }
  return <FleetEntityPage config={config} />;
}
