"use client";

import { useEffect, useState } from "react";
import { Heart, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { crudCreate, crudDelete, crudUpdate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

function tierFromPoints(pts: number): string {
  if (pts >= 10000) return "platinum";
  if (pts >= 5000) return "gold";
  if (pts >= 1000) return "silver";
  return "standard";
}

export default function CrmLoyaltyPage() {
  const { auth } = useUser();
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [ledger, setLedger] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    points: "100",
    entry_type: "earn",
    reason: "Promotion",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase
        .from("customers")
        .select("id,code,name,loyalty_points,loyalty_level")
        .order("loyalty_points", { ascending: false }),
      supabase
        .from("crm_loyalty_ledger")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setCustomers(c ?? []);
    setLedger(l ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const points = parseInt(form.points, 10);
    if (!points) return;
    const delta =
      form.entry_type === "redeem" ? -Math.abs(points) : Math.abs(points);
    const res = await crudCreate("crm_loyalty_ledger", {
      customer_id: form.customer_id,
      points: delta,
      entry_type: form.entry_type,
      reason: form.reason || null,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const cust = customers.find((c) => c.id === form.customer_id);
    const next = Math.max(0, Number(cust?.loyalty_points || 0) + delta);
    const cu = await crudUpdate("customers", form.customer_id, {
      loyalty_points: next,
      loyalty_level: tierFromPoints(next),
    });
    if (!cu.ok) {
      const ledgerId = (res.data as Record<string, unknown> | undefined)?.id;
      if (typeof ledgerId === "string") {
        await crudDelete("crm_loyalty_ledger", ledgerId);
      }
      toast.error(cu.error);
      return;
    }
    toast.success("Loyalty updated");
    setOpen(false);
    load();
  };

  if (loading) return <LoadingState />;

  const totalPoints = customers.reduce(
    (s, c) => s + Number(c.loyalty_points || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Customer Loyalty"
        description="Points, tiers (standard → silver → gold → platinum), rewards"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Adjust points
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={post}>
                <DialogHeader>
                  <DialogTitle>Loyalty ledger entry</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Select
                    value={form.customer_id}
                    onValueChange={(v) => setForm({ ...form, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={String(c.id)} value={String(c.id)}>
                          {String(c.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.entry_type}
                    onValueChange={(v) => setForm({ ...form, entry_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earn">Earn</SelectItem>
                      <SelectItem value="redeem">Redeem</SelectItem>
                      <SelectItem value="adjust">Adjust</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={form.points}
                    onChange={(e) =>
                      setForm({ ...form, points: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Reason"
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!form.customer_id}>
                    Post
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <StatCard
          title="Accounts"
          value={formatNumber(customers.length)}
          icon={Heart}
        />
        <StatCard title="Total points" value={formatNumber(totalPoints)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2">Balances</h3>
          {customers.length === 0 ? (
            <EmptyState title="No customers" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.slice(0, 30).map((c) => (
                    <TableRow key={String(c.id)}>
                      <TableCell className="font-medium">
                        {String(c.name)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {String(c.loyalty_level || "standard")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatNumber(Number(c.loyalty_points || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div>
          <h3 className="font-semibold mb-2">Ledger</h3>
          {ledger.length === 0 ? (
            <EmptyState title="No ledger entries" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((l) => {
                    const cust = l.customers as { name: string } | null;
                    return (
                      <TableRow key={String(l.id)}>
                        <TableCell>{cust?.name ?? "—"}</TableCell>
                        <TableCell className="capitalize">
                          {String(l.entry_type)}
                        </TableCell>
                        <TableCell
                          className={
                            Number(l.points) < 0
                              ? "text-red-600"
                              : "text-green-700"
                          }
                        >
                          {Number(l.points) > 0 ? "+" : ""}
                          {String(l.points)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
