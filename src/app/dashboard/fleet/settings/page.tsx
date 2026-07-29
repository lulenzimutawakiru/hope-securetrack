"use client";

import { FleetEntityPage } from "@/components/fleet/fleet-entity-page";
import { FLEET_ENTITIES } from "@/lib/fleet/entities";

export default function Page() {
  const config = FLEET_ENTITIES["settings"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: settings</div>;
  }
  return <FleetEntityPage config={config} />;
}
