"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { listCategories } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmCategoriesPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCategories()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading categories…" />;

  return (
    <div>
      <PageHeader
        title="Supplier Categories"
        description="Raw materials · packaging · machinery · logistics · services — unlimited custom categories"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/procurement">Hub</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Tags} title="No categories" description="Apply migration 00045 for seeded categories." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={String(c.id)}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{String(c.name)}</CardTitle>
                <Badge variant="secondary" className="font-mono text-[10px]">{String(c.code)}</Badge>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {String(c.description || "Active procurement category")}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
