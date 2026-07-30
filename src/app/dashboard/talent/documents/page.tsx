"use client";

import { TaEntityPage } from "@/components/ta/ta-entity-page";
import { TA_ENTITIES } from "@/lib/ta/entities";

export default function Page() {
  const config = TA_ENTITIES["documents"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: documents</div>;
  }
  return <TaEntityPage config={config} />;
}
