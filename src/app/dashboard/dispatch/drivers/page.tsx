"use client";

import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function DispatchDriversPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    driver_code: "",
    full_name: "",
    phone: "",
    license_number: "",
    license_expiry: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("dsp_drivers")
      .select("*")
      .order("driver_code");
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
      const crudRes = await crudCreate("dsp_drivers", {
        company_id: companyId,
        driver_code: form.driver_code.toUpperCase(),
        full_name: form.full_name,
        phone: form.phone,
        license_number: form.license_number,
        license_expiry: form.license_expiry || null,
        status: "available",
        safety_score: 100,
        performance_score: 80,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Driver added");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading drivers…" />;

  return (
    <div>
      <PageHeader
        title="Driver Management"
        description="License · safety score · performance · vehicle assignment"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Driver</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Add driver</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.driver_code} onChange={(e) => setForm((f) => ({ ...f, driver_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Full name</Label>
                    <Input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>License #</Label>
                      <Input value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} />
                    </div>
                    <div>
                      <Label>License expiry</Label>
                      <Input type="date" value={form.license_expiry} onChange={(e) => setForm((f) => ({ ...f, license_expiry: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No drivers" description="Seed DRV-001… after migration 00041." icon={Users} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Safety</TableHead>
                <TableHead>Perf</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.driver_code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.full_name)}</TableCell>
                  <TableCell className="text-xs">{String(r.phone || "—")}</TableCell>
                  <TableCell className="text-xs">
                    {String(r.license_number || "—")}
                    {r.license_expiry ? (
                      <span className="text-muted-foreground"> · {String(r.license_expiry).slice(0, 10)}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{String(r.safety_score ?? "—")}</TableCell>
                  <TableCell>{String(r.performance_score ?? "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
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
