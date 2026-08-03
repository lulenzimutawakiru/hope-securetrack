import { notFound } from "next/navigation";
import { AttEntityPage } from "@/components/attendance/att-entity-page";
import { resolveAttEntityConfig } from "@/lib/attendance/entities";

export const dynamic = "force-dynamic";

export default async function AttendanceEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveAttEntityConfig(entity);
  if (!config) notFound();
  return <AttEntityPage config={config} />;
}
