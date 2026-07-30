"use client";

import { PayEntityPage } from "@/components/payroll/pay-entity-page";
import { PAY_ENTITIES } from "@/lib/payroll/entities";

export default function Page() {
  const config = PAY_ENTITIES["documents"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: documents</div>;
  }
  return <PayEntityPage config={config} />;
}
