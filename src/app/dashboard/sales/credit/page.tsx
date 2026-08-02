"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function CreditPage() {
  const { auth } = useUser();
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase
        .from("customers")
        .select("id,code,name,credit_limit,credit_status,payment_terms_days,risk_rating")
        .order("name"),
      supabase
        .from("credit_reviews")
        .select("*, customers(name), sales_orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setCustomers(c ?? []);
    setReviews(r ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setCreditStatus = async (id: string, credit_status: string) => {
    const supabase = createClient();
    const crudRes3 = await crudUpdate("customers", id, { credit_status });
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else {
      toast.success("Credit status updated");
      load();
    }
  };

  const decideReview = async (id: string, decision: string, orderId?: string) => {
    if (!auth) return;
    const supabase = createClient();
    const crudRes2 = await crudUpdate("credit_reviews", id, { decision, reviewed_by: auth.profile.id });
    if (decision === "approved" && orderId) {
      const crudRes = await crudUpdate("sales_orders", orderId, {
          credit_approved: true,
          credit_approved_by: auth.profile.id,
          credit_approved_at: new Date().toISOString(),
          status: "confirmed",
        });
    }
    toast.success(`Credit ${decision}`);
    load();
  };

  if (loading) return <LoadingState />;

  const onHold = customers.filter((c) =>
    ["hold", "blocked"].includes(String(c.credit_status))
  ).length;

  return (
    <div>
      <PageHeader
        title="Credit Management"
        description="Limits, risk ratings, holds, partial releases · segregation of duties ready"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Accounts" value={formatNumber(customers.length)} icon={CreditCard} />
        <StatCard title="On hold / blocked" value={formatNumber(onHold)} />
        <StatCard
          title="Pending reviews"
          value={formatNumber(
            reviews.filter((r) => r.decision === "pending").length
          )}
        />
      </div>

      <h3 className="font-semibold mb-2">Customer credit</h3>
      {customers.length === 0 ? (
        <EmptyState title="No customers" />
      ) : (
        <div className="rounded-lg border mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Set status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={String(c.id)}>
                  <TableCell className="font-mono text-sm">{String(c.code)}</TableCell>
                  <TableCell className="font-medium">{String(c.name)}</TableCell>
                  <TableCell>
                    UGX {formatNumber(Number(c.credit_limit || 0))}
                  </TableCell>
                  <TableCell>Net {String(c.payment_terms_days || 30)}</TableCell>
                  <TableCell className="capitalize">
                    {String(c.risk_rating || "medium")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(c.credit_status || "ok")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={String(c.credit_status || "ok")}
                      onValueChange={(v) => setCreditStatus(String(c.id), v)}
                    >
                      <SelectTrigger className="w-[120px] ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["ok", "watch", "hold", "blocked"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-semibold mb-2">Credit reviews</h3>
      {reviews.length === 0 ? (
        <EmptyState title="No credit reviews" description="Orders exceeding limits create reviews automatically" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => {
                const cust = r.customers as { name: string } | null;
                const so = r.sales_orders as { order_number: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {so?.order_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(r.credit_limit || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.decision)} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.decision === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              decideReview(
                                String(r.id),
                                "approved",
                                r.sales_order_id
                                  ? String(r.sales_order_id)
                                  : undefined
                              )
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              decideReview(String(r.id), "rejected")
                            }
                          >
                            Reject
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
      )}
    </div>
  );
}
