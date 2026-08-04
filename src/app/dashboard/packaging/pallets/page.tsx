"use client";

import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { buildPallet } from "@/lib/packaging";

export default function PkgPalletsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [serialsText, setSerialsText] = useState("");
  const [building, setBuilding] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_pallets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const build = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBuilding(true);
    try {
      const serials = serialsText
        .split(/[\n,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const pallet = await buildPallet({
        company_id: companyId,
        carton_serials: serials,
        built_by: auth?.user?.id,
      });
      toast.success(`Pallet ${pallet.pallet_number} built · ${serials.length} cartons`);
      setOpen(false);
      setSerialsText("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBuilding(false);
    }
  };

  if (loading) return <LoadingState message="Loading pallets…" />;

  return (
    <div>
      <PageHeader
        title="Palletization"
        description="Stack cartons · master QR · weight · warehouse location"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Build pallet</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={build}>
                <DialogHeader><DialogTitle>Build pallet</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Carton serials (one per line, max 40)</Label>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={serialsText}
                      onChange={(e) => setSerialsText(e.target.value)}
                      placeholder={"CTN-00001\nCTN-00002\n..."}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={building}>{building ? "Building…" : "Build"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Layers} title="No pallets" description="Stack completed cartons onto a pallet." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Cartons</TableHead>
                <TableHead className="text-right">Gross kg</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Built</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm font-medium">{String(r.pallet_number)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.pallet_type)}</TableCell>
                  <TableCell className="text-right">
                    {String(r.carton_count)}/{String(r.max_cartons)}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.gross_weight_kg || 0))}</TableCell>
                  <TableCell className="text-xs">{String(r.warehouse_location || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.completed_at ? formatDateTime(String(r.completed_at)) : "—"}
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
