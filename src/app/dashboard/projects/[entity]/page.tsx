import { notFound } from "next/navigation";
import { PpmEntityPage } from "@/components/ppm/ppm-entity-page";
import { resolvePpmEntityConfig } from "@/lib/ppm/entities";

export const dynamic = "force-dynamic";

export default async function ProjectsEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolvePpmEntityConfig(entity);
  if (!config) notFound();
  return <PpmEntityPage config={config} />;
}
