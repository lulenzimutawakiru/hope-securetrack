import { notFound } from "next/navigation";
import { PayEntityPage } from "@/components/payroll/pay-entity-page";
import { resolvePayEntityConfig } from "@/lib/payroll/entities";

export const dynamic = "force-dynamic";

export default async function PayrollEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolvePayEntityConfig(entity);
  if (!config) notFound();
  return <PayEntityPage config={config} />;
}
