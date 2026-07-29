"use client";

import { LblEntityPage } from "@/components/lbl/lbl-entity-page";
import { LBL_ENTITIES } from "@/lib/lbl/entities";

export default function Page() {
  const config = LBL_ENTITIES["jobs"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: jobs</div>;
  }
  return <LblEntityPage config={config} />;
}
