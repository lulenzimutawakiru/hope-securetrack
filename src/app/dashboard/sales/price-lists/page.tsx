"use client";

import { SalesEntityPage } from "@/components/sales/sales-entity-page";
import { SALES_ENTITIES } from "@/lib/sales/entities";

export default function Page() {
  const config = SALES_ENTITIES["price-lists"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: price-lists</div>;
  }
  return <SalesEntityPage config={config} />;
}
