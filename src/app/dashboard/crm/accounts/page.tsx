"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEntityList, useCrudMutation } from "@/hooks/use-entity-query";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: string;
  code: string;
  name: string;
  customer_type: string | null;
  industry: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  credit_status: string | null;
  credit_limit: number | null;
  loyalty_level: string | null;
  loyalty_points: number | null;
  territory: string | null;
  is_active: boolean;
}

const PAGE_SIZE = 100;

export default function CrmAccountsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    customer_type: "corporate",
    industry: "Security Printing",
    city: "Kampala",
    phone: "",
    email: "",
    credit_limit: "5000000",
    territory: "Central Uganda",
  });

  // Debounce the search box before it reaches the server-side query.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reads flow through the hardened CRUD API; search is server-side over the
  // registered searchable fields (name, code, email).
  const { data, isPending } = useEntityList<Customer>("customers", {
    page,
    pageSize: PAGE_SIZE,
    sort: "name",
    search: search.trim() || undefined,
  });
  const crud = useCrudMutation<Customer>("customers");

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code || `CUS-${Date.now().toString(36).toUpperCase()}`;
    const res = await crud.create({
      name: form.name,
      code,
      customer_type: form.customer_type,
      industry: form.industry,
      city: form.city,
      phone: form.phone || null,
      email: form.email || null,
      credit_limit: parseFloat(form.credit_limit) || 0,
      credit_status: "ok",
      currency: "UGX",
      payment_terms_days: 30,
      loyalty_level: "standard",
      loyalty_points: 0,
      territory: form.territory,
      is_active: true,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Account created");
      setOpen(false);
    }
  };

  if (isPending) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="CRM Accounts"
        description="Corporate, government, dealers, export — master data & 360° access"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create customer account</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Account name</Label>
                    <Input
                      required
                      placeholder="Acme Corp"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input
                      placeholder="Auto-generated"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.customer_type}
                      onValueChange={(v) =>
                        setForm({ ...form, customer_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Input
                      value={form.industry}
                      onChange={(e) =>
                        setForm({ ...form, industry: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                    <Input
                      placeholder="Territory"
                      value={form.territory}
                      onChange={(e) =>
                        setForm({ ...form, territory: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Credit limit UGX"
                    value={form.credit_limit}
                    onChange={(e) =>
                      setForm({ ...form, credit_limit: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Save account</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search accounts…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No accounts" />
      ) : (
        <div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Loyalty</TableHead>
                  <TableHead className="text-right">360°</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.city, c.phone].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {(c.customer_type || "—").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm">{c.territory ?? "—"}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        UGX {formatNumber(Number(c.credit_limit || 0))}
                      </div>
                      <StatusBadge status={c.credit_status || "ok"} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {c.loyalty_level || "standard"}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground">
                        {c.loyalty_points ?? 0} pts
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/crm/accounts/${c.id}`}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
