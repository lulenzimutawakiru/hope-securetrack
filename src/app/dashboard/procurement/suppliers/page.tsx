"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SuppliersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "raw_materials",
    email: "",
    phone: "",
    country: "Uganda",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("name")
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("suppliers").insert({
      company_id: auth.profile.company_id,
      code: form.code,
      name: form.name,
      category: form.category,
      email: form.email || null,
      phone: form.phone || null,
      country: form.country,
      is_approved_vendor: false,
      is_active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Supplier created");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(r.name).toLowerCase().includes(s) ||
      String(r.code).toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Vendor master · TIN/VAT · categories · risk · approved vendor status"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add supplier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No suppliers" description="Add approved vendors" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>OTD %</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.code)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{String(r.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(r.email ?? r.contact_person ?? "")}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {String(r.category ?? "—").replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{String(r.country ?? "—")}</TableCell>
                  <TableCell>{formatNumber(Number(r.on_time_delivery_pct ?? 0))}%</TableCell>
                  <TableCell>{formatNumber(Number(r.quality_score ?? 0))}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        Number(r.risk_score) >= 60
                          ? "border-red-300 text-red-700"
                          : Number(r.risk_score) >= 40
                            ? "border-amber-300 text-amber-700"
                            : "border-green-300 text-green-700"
                      }
                    >
                      {String(r.risk_score ?? "—")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatNumber(Number(r.overall_score ?? 0))}
                  </TableCell>
                  <TableCell>
                    {r.is_approved_vendor ? (
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
