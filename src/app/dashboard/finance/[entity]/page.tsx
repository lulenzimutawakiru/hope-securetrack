import { notFound } from "next/navigation";
import { FinEntityPage } from "@/components/finance/fin-entity-page";
import { resolveFinEntityConfig } from "@/lib/finance/entities";

export const dynamic = "force-dynamic";

/**
 * Dynamic finance EntityPage route.
 * Replaces hundreds of thin generated `finance/<slug>/page.tsx` wrappers.
 * Static specialist pages (coa, journals, engine, …) still take precedence.
 */
export default async function FinanceEntityRoute({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const config = resolveFinEntityConfig(entity);
  if (!config) notFound();
  return <FinEntityPage config={config} />;
}
