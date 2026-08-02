"use client";

import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { crudCreate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { Distributor } from "@/types/database";

export default function DistributorsPage() {
  const { auth, hasPermission } = useUser();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    contact_person: "",
    email: "",
    phone: "",
    city: "",
    region: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("distributors")
      .select("*")
      .order("name");
    setDistributors((data as Distributor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const res = await crudCreate("distributors", {
        ...form,
        is_active: true,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Distributor added");
      setOpen(false);
      setForm({
        name: "",
        code: "",
        contact_person: "",
        email: "",
        phone: "",
        city: "",
        region: "",
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add distributor");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Distributors"
        description="Distribution network partners"
        actions={
          hasPermission("distributors.manage") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Distributor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Add Distributor</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          value={form.code}
                          onChange={(e) => setForm({ ...form, code: e.target.value })}
                          required
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input
                        value={form.contact_person}
                        onChange={(e) =>
                          setForm({ ...form, contact_person: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Input
                          value={form.region}
                          onChange={(e) => setForm({ ...form, region: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {distributors.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No distributors"
          description="Add distributors to track product distribution"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{d.contact_person ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{d.phone ?? "—"}</TableCell>
                  <TableCell>{d.city ?? "—"}</TableCell>
                  <TableCell>{d.region ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
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
