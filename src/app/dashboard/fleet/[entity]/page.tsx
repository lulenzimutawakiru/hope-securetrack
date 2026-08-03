import { notFound } from "next/navigation";
import { FleetEntityPage } from "@/components/fleet/fleet-entity-page";
import { resolveFleetEntityConfig } from "@/lib/fleet/entities";

export const dynamic = "force-dynamic";

export default async function FleetEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveFleetEntityConfig(entity);
  if (!config) notFound();
  return <FleetEntityPage config={config} />;
}
