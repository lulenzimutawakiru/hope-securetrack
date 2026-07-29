"use client";

import { SalesEntityPage } from "@/components/sales/sales-entity-page";
import { SALES_ENTITIES } from "@/lib/sales/entities";

export default function Page() {
  const config = SALES_ENTITIES["return-lines"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: return-lines</div>;
  }
  return <SalesEntityPage config={config} />;
}
