"use client";

import { useEffect, useState } from "react";
import { Hash, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatIdentityNumber } from "@/lib/workforce-id";

type Seq = {
  id: string;
  sequence_code: string;
  name: string;
  prefix: string;
  category_code: string;
  include_year: boolean;
  include_location: boolean;
  location_code: string | null;
  pad_length: number;
  next_value: number;
  check_digit: boolean;
  separator: string;
  is_active: boolean;
};

export default function NumberingPage() {
  const [rows, setRows] = useState<Seq[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("wid_id_sequences").select("*").order("sequence_code");
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
      const supabase = createClient();
      const { error } = await supabase
        .from("wid_id_sequences")
        .update({
          name: row.name,
          prefix: row.prefix,
          category_code: row.category_code,
          include_year: row.include_year,
          include_location: row.include_location,
          location_code: row.location_code,
          pad_length: row.pad_length,
          next_value: row.next_value,
          check_digit: row.check_digit,
          separator: row.separator,
          is_active: row.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(`${row.sequence_code} saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (loading) return <LoadingState message="Loading ID sequences…" />;

  return (
    <div>
      <PageHeader
        title="Smart ID Number Engine"
        description="HDG-EMP-2026-000001 · prefix · year · location · sequence · check digit"
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Pad</TableHead>
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
                <TableCell>
                  <Input className="h-8" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 w-20" value={r.prefix} onChange={(e) => update(r.id, { prefix: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 w-20" value={r.category_code} onChange={(e) => update(r.id, { category_code: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 w-16"
                    type="number"
                    value={r.pad_length}
                    onChange={(e) => update(r.id, { pad_length: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 w-20"
                    type="number"
                    value={r.next_value}
                    onChange={(e) => update(r.id, { next_value: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="text-xs space-y-1">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={r.include_year} onChange={(e) => update(r.id, { include_year: e.target.checked })} /> Year
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={r.check_digit} onChange={(e) => update(r.id, { check_digit: e.target.checked })} /> Check digit
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={r.include_location} onChange={(e) => update(r.id, { include_location: e.target.checked })} /> Location
                  </label>
                  {r.include_location && (
                    <Input
                      className="h-7 w-20"
                      placeholder="LOC"
                      value={r.location_code || ""}
                      onChange={(e) => update(r.id, { location_code: e.target.value })}
                    />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-teal-700">
                  <Hash className="inline h-3 w-3 mr-1" />
                  {formatIdentityNumber(r)}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => save(r)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <Label className="text-xs">Examples</Label>
        <p>HDG-EMP-2026-000001 · HDG-PROD-2026-000254 · HDG-SEC-2026-000012</p>
      </div>
    </div>
  );
}
