"use client";

import { useEffect, useState } from "react";
import { Mail, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { suggestEmailSignature } from "@/lib/branding";

export default function BrandEmailPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    fullName: "",
    jobTitle: "",
    phone: "",
    html_body: "",
    is_default: false,
  });


  const load = async () => {
    const { data } = await createClient()
      .from("brand_email_signatures")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const generate = () => {
    const html = suggestEmailSignature({
      fullName: form.fullName || "John Doe",
      jobTitle: form.jobTitle || "Production Manager",
      phone: form.phone,
      brandName: "SecureTrack ERP",
      website: "https://hopedesign.ug",
      primaryColor: "#0D7377",
    });
    setForm((f) => ({ ...f, html_body: html, name: f.name || `${f.fullName || "Staff"} signature` }));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    let html = form.html_body;
    if (!html) {
      html = suggestEmailSignature({
        fullName: form.fullName || "Staff",
        jobTitle: form.jobTitle || "Team Member",
        phone: form.phone,
      });
    }
    const res = await crudCreate("brand_email_signatures", {
      name: form.name || "Email signature",
      html_body: html,
      is_default: form.is_default,
      status: "active",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Email signature saved");
    setOpen(false);
    await load();
  };

  if (loading) return <LoadingState message="Loading email branding…" />;

  const preview = rows.find((r) => String(r.id) === previewId) || rows[0];

  return (
    <div>
      <PageHeader
        title="Email Branding"
        description="Signatures · templates · newsletters · branded notifications"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New signature</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create email signature</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Signature name</Label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Standard staff signature" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Full name</Label>
                      <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Job title</Label>
                      <Input value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={generate}>Generate with AI helper</Button>
                  <div>
                    <Label>HTML body</Label>
                    <Textarea rows={6} value={form.html_body} onChange={(e) => setForm((f) => ({ ...f, html_body: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Mail} title="No signatures" description="Create branded email signatures for staff and notifications." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => setPreviewId(String(r.id))}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 ${
                  String(preview?.id) === String(r.id) ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{String(r.name)}</span>
                  {Boolean(r.is_default) && <Badge variant="outline" className="text-[10px]">default</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground">{String(r.status)}</p>
              </button>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
            <CardContent>
              {preview ? (
                <div
                  className="rounded border bg-white p-4"
                  dangerouslySetInnerHTML={{
                    __html: String(preview.html_body || "")
                      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
                      .replace(/javascript:/gi, ""),
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
