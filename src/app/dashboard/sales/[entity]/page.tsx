import { notFound } from "next/navigation";
import { SalesEntityPage } from "@/components/sales/sales-entity-page";
import { resolveSalesEntityConfig } from "@/lib/sales/entities";

export const dynamic = "force-dynamic";

export default async function SalesEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveSalesEntityConfig(entity);
  if (!config) notFound();
  return <SalesEntityPage config={config} />;
}
