"use client";

import { useEffect, useState } from "react";
import { Scale, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function IdentityApprovalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    document_type: "purchase_order",
    max_amount: "5000000",
    currency: "UGX",
    is_unlimited: "false",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("approval_authority")
      .select("*")
      .order("document_type")
      .order("max_amount");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const unlimited = form.is_unlimited === "true";
    const supabase = createClient();
    const crudRes = await crudCreate("approval_authority", {
      company_id: auth.profile.company_id,
      document_type: form.document_type,
      max_amount: unlimited ? null : parseFloat(form.max_amount),
      currency: form.currency,
      is_unlimited: unlimited,
      is_active: true,
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Authority rule added");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Approval Authority Matrix"
        description="Segregation of duties · value limits · document types (PO, credit, discounts)"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Approval rule</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select
                      value={form.document_type}
                      onValueChange={(v) =>
                        setForm({ ...form, document_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "purchase_order",
                          "sales_discount",
                          "credit_release",
                          "payment",
                          "leave",
                          "overtime",
                        ].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unlimited?</Label>
                    <Select
                      value={form.is_unlimited}
                      onValueChange={(v) =>
                        setForm({ ...form, is_unlimited: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No — set limit</SelectItem>
                        <SelectItem value="true">Yes — MD / unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.is_unlimited === "false" && (
                    <div className="space-y-2">
                      <Label>Max amount</Label>
                      <Input
                        type="number"
                        value={form.max_amount}
                        onChange={(e) =>
                          setForm({ ...form, max_amount: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <p className="text-sm text-muted-foreground mb-4">
        Example matrix: Procurement Officer ≤ UGX 5M · Procurement Manager ≤ UGX
        100M · Managing Director unlimited.
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={Scale} title="No approval rules" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="capitalize font-medium">
                    {String(r.document_type).replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    {r.is_unlimited
                      ? "Unlimited"
                      : formatNumber(Number(r.max_amount || 0))}
                  </TableCell>
                  <TableCell>{String(r.currency || "UGX")}</TableCell>
                  <TableCell>{String(r.department || "—")}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"}>
                      {r.is_active ? "Active" : "Inactive"}
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
