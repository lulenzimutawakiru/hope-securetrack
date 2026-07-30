"use client";

import { PayEntityPage } from "@/components/payroll/pay-entity-page";
import { PAY_ENTITIES } from "@/lib/payroll/entities";

export default function Page() {
  const config = PAY_ENTITIES["corrections"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: corrections</div>;
  }
  return <PayEntityPage config={config} />;
}
