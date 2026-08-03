import { notFound } from "next/navigation";
import { TaEntityPage } from "@/components/ta/ta-entity-page";
import { resolveTaEntityConfig } from "@/lib/ta/entities";

export const dynamic = "force-dynamic";

export default async function TalentEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveTaEntityConfig(entity);
  if (!config) notFound();
  return <TaEntityPage config={config} />;
}
