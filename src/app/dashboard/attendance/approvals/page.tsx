"use client";

import { AttEntityPage } from "@/components/attendance/att-entity-page";
import { ATT_ENTITIES } from "@/lib/attendance/entities";

export default function Page() {
  const config = ATT_ENTITIES["approvals"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: approvals</div>;
  }
  return <AttEntityPage config={config} />;
}
