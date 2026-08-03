"use client";

import { useEffect, useState } from "react";
import { IdCard, Plus, Eye } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import {
  nextPrtCode, enqueuePrint, generateIdCardVars, defaultCanvas, renderLabelHtml,
} from "@/lib/print";

export default function PrintIdCardsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    card_type: "staff",
    full_name: "",
    employee_number: "",
    department: "",
    position_title: "",
    rfid_number: "",
    expiry_date: "",
    printer_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }] = await Promise.all([
      sb.from("prt_id_card_jobs").select("*").order("created_at", { ascending: false }).limit(100),
      sb.from("printers").select("id,name").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const job_number = await nextPrtCode(companyId, "prt_id_card_jobs", "IDC");
      const vars = generateIdCardVars({
        fullName: form.full_name,
        employeeNumber: form.employee_number,
        department: form.department,
        title: form.position_title,
        rfid: form.rfid_number,
        expiry: form.expiry_date,
      });
      const queue = await enqueuePrint({
        company_id: companyId,
        job_title: `ID Card · ${form.full_name}`,
        document_type: "id_card",
        printer_id: form.printer_id || null,
        copies: 1,
        payload_json: { ...vars, card_type: form.card_type, front: true, back: true },
        submitted_by: auth?.user?.id,
      });
      const crudRes = await crudCreate("prt_id_card_jobs", {
        company_id: companyId,
        job_number,
        card_type: form.card_type,
        full_name: form.full_name,
        employee_number: form.employee_number || null,
        department: form.department || null,
        position_title: form.position_title || null,
        rfid_number: form.rfid_number || null,
        barcode_value: form.employee_number || form.rfid_number,
        qr_token: vars.id_token,
        expiry_date: form.expiry_date || null,
        printer_id: form.printer_id || null,
        queue_id: queue.id,
        status: "printing",
        created_by: auth?.user?.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("ID card job queued (front + back layout)");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const showPreview = (r: Record<string, unknown>) => {
    const layout = defaultCanvas(85.6, 54);
    layout.elements = [
      { id: "1", type: "logo", x: 4, y: 4 },
      { id: "2", type: "text", field: "full_name", text: "{{full_name}}", x: 4, y: 18 },
      { id: "3", type: "text", field: "title", text: "{{title}}", x: 4, y: 26 },
      { id: "4", type: "text", field: "department", text: "{{department}}", x: 4, y: 32 },
      { id: "5", type: "qr", field: "id_token", x: 60, y: 12, size: 28 },
      { id: "6", type: "barcode", field: "employee_number", x: 4, y: 42, w: 50, h: 8 },
    ];
    const html = renderLabelHtml(layout, {
      full_name: String(r.full_name),
      title: String(r.position_title || ""),
      department: String(r.department || ""),
      employee_number: String(r.employee_number || ""),
      id_token: String(r.qr_token || r.employee_number || ""),
    }, { companyName: "SecureTrack ERP" });
    setPreview(html);
  };

  if (loading) return <LoadingState message="Loading ID card jobs…" />;

  return (
    <div>
      <PageHeader
        title="Employee ID Card Printing"
        description="Staff · contractor · visitor · photo · QR · RFID · front/back"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New ID job</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Print ID card</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Card type</Label>
                    <Select value={form.card_type} onValueChange={(v) => setForm((f) => ({ ...f, card_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="visitor">Visitor pass</SelectItem>
                        <SelectItem value="temporary">Temporary access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Full name</Label>
                    <Input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Employee #</Label>
                      <Input value={form.employee_number} onChange={(e) => setForm((f) => ({ ...f, employee_number: e.target.value }))} />
                    </div>
                    <div>
                      <Label>RFID</Label>
                      <Input value={form.rfid_number} onChange={(e) => setForm((f) => ({ ...f, rfid_number: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Department</Label>
                      <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Position</Label>
                      <Input value={form.position_title} onChange={(e) => setForm((f) => ({ ...f, position_title: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Expiry</Label>
                      <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Printer</Label>
                      <Select value={form.printer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, printer_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default / card printer</SelectItem>
                          {printers.map((p) => (
                            <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Queue print</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={IdCard} title="No ID card jobs" description="Queue staff, contractor, or visitor cards." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.job_number)}</TableCell>
                  <TableCell className="font-medium text-sm">
                    {String(r.full_name)}
                    <div className="text-[10px] text-muted-foreground">{String(r.employee_number || "")}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.card_type)}</TableCell>
                  <TableCell className="text-sm">{String(r.department || "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.rfid_number || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => showPreview(r)}>
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Card front preview</DialogTitle></DialogHeader>
          {preview && <iframe title="ID card" srcDoc={preview} className="w-full h-[280px] rounded border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
