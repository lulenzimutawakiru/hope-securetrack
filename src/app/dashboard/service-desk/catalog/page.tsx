"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { submitCatalogRequest, approveCatalogRequest } from "@/lib/service-desk";

export default function ServiceCatalogPage() {
  const { auth } = useUser();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: cat }, { data: it }, { data: req }] = await Promise.all([
      supabase.from("sd_catalog_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("sd_catalog_items").select("*, sd_catalog_categories(name)").eq("is_active", true),
      supabase
        .from("sd_catalog_requests")
        .select("*, sd_catalog_items(name,item_code)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setCategories((cat as Array<Record<string, unknown>>) || []);
    setItems((it as Array<Record<string, unknown>>) || []);
    setRequests((req as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const requestItem = async (itemId: string) => {
    if (!companyId) return;
    setBusy(itemId);
    try {
      const { request, ticket } = await submitCatalogRequest({
        company_id: companyId,
        catalog_item_id: itemId,
        requester_id: auth?.user?.id,
        actor_name: auth?.profile
          ? `${auth.profile.first_name} ${auth.profile.last_name}`
          : null,
        form_data: { notes: "Requested via service catalog" },
      });
      toast.success(`${request.request_number} → ticket ${ticket.ticket_number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Loading service catalog…" />;

  return (
    <div>
      <PageHeader
        title="Service Catalog"
        description="Self-service marketplace · approvals · fulfillment · cost tracking"
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Categories" value={String(categories.length)} icon={ShoppingBag} />
        <StatCard title="Items" value={String(items.length)} icon={ShoppingBag} />
        <StatCard title="Requests" value={String(requests.length)} icon={ShoppingBag} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {items.map((item) => (
          <Card key={String(item.id)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between gap-2">
                <CardTitle className="text-base">{String(item.name)}</CardTitle>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {String(item.item_code)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {String(item.description || "—")}
              </p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline" className="capitalize">{String(item.service_type)}</Badge>
                {Boolean(item.requires_approval) && <Badge variant="outline">Approval</Badge>}
                <Badge variant="outline">UGX {formatNumber(Number(item.estimated_cost || 0))}</Badge>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={busy === item.id}
                onClick={() => requestItem(String(item.id))}
              >
                {busy === item.id ? "Submitting…" : "Request"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent catalog requests</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const item = r.sd_catalog_items as { name?: string; item_code?: string } | null;
                  return (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-mono text-sm">{String(r.request_number)}</TableCell>
                      <TableCell className="text-sm">{item?.name || "—"}</TableCell>
                      <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                      <TableCell className="capitalize text-sm">{String(r.approval_status)}</TableCell>
                      <TableCell className="text-right">{formatNumber(Number(r.cost || 0))}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.approval_status === "pending" && auth?.user?.id && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                await approveCatalogRequest(String(r.id), auth.user!.id, true);
                                toast.success("Approved");
                                await load();
                              }}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                await approveCatalogRequest(String(r.id), auth.user!.id, false);
                                toast.success("Rejected");
                                await load();
                              }}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
