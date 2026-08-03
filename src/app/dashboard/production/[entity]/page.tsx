import { notFound } from "next/navigation";
import { MesEntityPage } from "@/components/mes/mes-entity-page";
import { resolveMesEntityConfig } from "@/lib/mes/entities";

export const dynamic = "force-dynamic";

export default async function ProductionEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveMesEntityConfig(entity);
  if (!config) notFound();
  return <MesEntityPage config={config} />;
}
