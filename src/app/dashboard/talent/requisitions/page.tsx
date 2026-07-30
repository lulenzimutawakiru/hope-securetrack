"use client";

import { TaEntityPage } from "@/components/ta/ta-entity-page";
import { TA_ENTITIES } from "@/lib/ta/entities";

export default function Page() {
  const config = TA_ENTITIES["requisitions"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: requisitions</div>;
  }
  return <TaEntityPage config={config} />;
}
