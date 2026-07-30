"use client";

import { TaEntityPage } from "@/components/ta/ta-entity-page";
import { TA_ENTITIES } from "@/lib/ta/entities";

export default function Page() {
  const config = TA_ENTITIES["agencies"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: agencies</div>;
  }
  return <TaEntityPage config={config} />;
}
