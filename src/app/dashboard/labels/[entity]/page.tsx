import { notFound } from "next/navigation";
import { LblEntityPage } from "@/components/lbl/lbl-entity-page";
import { resolveLblEntityConfig } from "@/lib/lbl/entities";

export const dynamic = "force-dynamic";

export default async function LabelsEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveLblEntityConfig(entity);
  if (!config) notFound();
  return <LblEntityPage config={config} />;
}
