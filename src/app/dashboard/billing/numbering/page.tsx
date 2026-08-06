"use client";

import { useEffect, useState } from "react";
import { Hash, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { formatBillNumber } from "@/lib/billing";

type Seq = {
  id: string;
  sequence_code: string;
  name: string;
  doc_type: string;
  prefix: string;
  branch_code: string | null;
  include_year: boolean;
  include_month: boolean;
  pad_length: number;
  next_value: number;
  check_digit: boolean;
  separator: string;
};

export default function BillingNumberingPage() {
  const [rows, setRows] = useState<Seq[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("bill_sequences").select("*").order("sequence_code");
    setRows((data as Seq[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<Seq>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const save = async (row: Seq) => {
    try {
      const crudRes = await crudUpdate("bill_sequences", row.id, {
          name: row.name,
          prefix: row.prefix,
          branch_code: row.branch_code,
          include_year: row.include_year,
          include_month: row.include_month,
          pad_length: row.pad_length,
          next_value: row.next_value,
          check_digit: row.check_digit,
          separator: row.separator,
          updated_at: new Date().toISOString(),
        });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success(`${row.sequence_code} saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (loading) return <LoadingState message="Loading sequencesâ€¦" />;

  return (
    <div>
      <PageHeader
        title="Invoice Numbering Engine"
        description="HDG-INV-2026-000001 Â· branch Â· year Â· month Â· sequence Â· check digit"
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Next</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.sequence_code}</TableCell>
                <TableCell><Input className="h-8" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} /></TableCell>
                <TableCell><Input className="h-8 w-28" value={r.prefix} onChange={(e) => update(r.id, { prefix: e.target.value })} /></TableCell>
                <TableCell><Input className="h-8 w-20" value={r.branch_code || ""} onChange={(e) => update(r.id, { branch_code: e.target.value })} placeholder="KLA" /></TableCell>
                <TableCell><Input className="h-8 w-20" type="number" value={r.next_value} onChange={(e) => update(r.id, { next_value: Number(e.target.value) })} /></TableCell>
                <TableCell className="text-xs space-y-1">
                  <label className="flex gap-1 items-center"><input type="checkbox" checked={r.include_year} onChange={(e) => update(r.id, { include_year: e.target.checked })} /> Year</label>
                  <label className="flex gap-1 items-center"><input type="checkbox" checked={r.include_month} onChange={(e) => update(r.id, { include_month: e.target.checked })} /> Month</label>
                  <label className="flex gap-1 items-center"><input type="checkbox" checked={r.check_digit} onChange={(e) => update(r.id, { check_digit: e.target.checked })} /> Check</label>
                </TableCell>
                <TableCell className="font-mono text-xs text-teal-700">
                  <Hash className="inline h-3 w-3" /> {formatBillNumber(r)}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => save(r)}><Save className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
