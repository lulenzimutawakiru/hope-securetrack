"use client";

import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { createBrandProfile } from "@/lib/branding";

export default function BrandProfilesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    brand_name: "",
    trading_name: "",
    email: "",
    website: "",
    phone: "",
    address: "",
    is_primary: false,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_profiles")
      .select("*")
      .is("deleted_at", null)
      .order("is_primary", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createBrandProfile({ company_id: companyId, ...form });
      toast.success("Brand profile created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading brand profiles…" />;

  return (
    <div>
      <PageHeader
        title="Brand Profiles"
        description="Multi-company corporate identity · legal entity · contacts"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New brand</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create brand profile</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Company / brand name</Label>
                    <Input required value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Trading name</Label>
                    <Input value={form.trading_name} onChange={(e) => setForm((f) => ({ ...f, trading_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Email</Label>
                      <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))} />
                    Primary brand for this company
                  </label>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No brand profiles" description="Apply migration 00033 or create a brand." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Trading</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.brand_code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.brand_name)}</TableCell>
                  <TableCell className="text-sm">{String(r.trading_name || "—")}</TableCell>
                  <TableCell className="text-xs">
                    {String(r.email || "—")}<br />{String(r.website || "")}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {r.is_primary ? <Badge>Primary</Badge> : null}
                    {r.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
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
