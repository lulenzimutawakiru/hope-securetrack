"use client";

import { FinEntityPage } from "@/components/finance/fin-entity-page";
import { FIN_ENTITIES } from "@/lib/finance/entities";

export default function Page() {
  const config = FIN_ENTITIES["mobile-money"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: mobile-money</div>;
  }
  return <FinEntityPage config={config} />;
}
