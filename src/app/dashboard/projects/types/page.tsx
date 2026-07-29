"use client";

import { PpmEntityPage } from "@/components/ppm/ppm-entity-page";
import { PPM_ENTITIES } from "@/lib/ppm/entities";

export default function Page() {
  const config = PPM_ENTITIES["types"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: types</div>;
  }
  return <PpmEntityPage config={config} />;
}
