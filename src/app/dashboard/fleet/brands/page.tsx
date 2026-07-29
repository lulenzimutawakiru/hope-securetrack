"use client";

import { FleetEntityPage } from "@/components/fleet/fleet-entity-page";
import { FLEET_ENTITIES } from "@/lib/fleet/entities";

export default function Page() {
  const config = FLEET_ENTITIES["brands"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: brands</div>;
  }
  return <FleetEntityPage config={config} />;
}
