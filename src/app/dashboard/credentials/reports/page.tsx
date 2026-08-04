"use client";

import { useEffect, useState } from "react";
import { FileBarChart, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv } from "@/lib/documents";
import { toast } from "sonner";

export default function CredentialReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    identities: 0,
    cards: 0,
    active: 0,
    expired: 0,
    lost: 0,
    inventory: 0,
    prints: 0,
    verifications: 0,
    incidents: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const counts = await Promise.all([
        supabase.from("wid_identities").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "expired"),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).in("status", ["lost", "stolen"]),
        supabase.from("wid_card_inventory").select("quantity_available"),
        supabase.from("wid_print_jobs").select("*", { count: "exact", head: true }),
        supabase.from("wid_verification_logs").select("*", { count: "exact", head: true }),
        supabase.from("wid_card_incidents").select("*", { count: "exact", head: true }),
      ]);
      const inv = (counts[5].data || []) as Array<{ quantity_available: number }>;
      setSummary({
        identities: counts[0].count ?? 0,
        cards: counts[1].count ?? 0,
        active: counts[2].count ?? 0,
        expired: counts[3].count ?? 0,
        lost: counts[4].count ?? 0,
        inventory: inv.reduce((s, r) => s + (r.quantity_available || 0), 0),
        prints: counts[6].count ?? 0,
        verifications: counts[7].count ?? 0,
        incidents: counts[8].count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const exportRegister = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("wid_identities")
        .select("identity_number,full_name,identity_type,department,job_title,status,security_clearance,email,hire_date,expiry_date")
        .is("deleted_at", null)
        .order("identity_number");
      downloadCsv(
        "employee-id-register.csv",
        ["Identity#", "Name", "Type", "Department", "Title", "Status", "Clearance", "Email", "Hire", "Expiry"],
        (data || []).map((r) => [
          r.identity_number,
          r.full_name,
          r.identity_type,
          r.department,
          r.job_title,
          r.status,
          r.security_clearance,
          r.email,
          r.hire_date,
          r.expiry_date,
        ])
      );
      toast.success("ID register exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportCards = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("wid_credentials")
        .select("credential_number,status,credential_type,qr_public_id,rfid_uid,expiry_date,issue_date,access_profile_code,wid_identities(full_name,identity_number,department)")
        .is("deleted_at", null);
      downloadCsv(
        "card-register.csv",
        ["Credential", "Holder", "Identity#", "Dept", "Status", "Type", "QR", "RFID", "Access", "Issue", "Expiry"],
        (data || []).map((r) => {
          const id = r.wid_identities as { full_name?: string; identity_number?: string; department?: string } | null;
          return [
            r.credential_number,
            id?.full_name,
            id?.identity_number,
            id?.department,
            r.status,
            r.credential_type,
            r.qr_public_id,
            r.rfid_uid,
            r.access_profile_code,
            r.issue_date,
            r.expiry_date,
          ];
        })
      );
      toast.success("Card register exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportVerifications = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("wid_verification_logs")
        .select("created_at,result,qr_public_id,scanner_context,location_name")
        .order("created_at", { ascending: false })
        .limit(2000);
      downloadCsv(
        "verification-history.csv",
        ["Time", "Result", "QR", "Context", "Location"],
        (data || []).map((r) => [r.created_at, r.result, r.qr_public_id, r.scanner_context, r.location_name])
      );
      toast.success("Verification history exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportLost = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("wid_card_incidents")
        .select("incident_number,incident_type,status,reported_at,description,wid_identities(full_name),wid_credentials(credential_number)");
      downloadCsv(
        "lost-card-report.csv",
        ["Incident", "Type", "Status", "Reported", "Holder", "Card", "Description"],
        (data || []).map((r) => {
          const id = r.wid_identities as { full_name?: string } | null;
          const c = r.wid_credentials as { credential_number?: string } | null;
          return [r.incident_number, r.incident_type, r.status, r.reported_at, id?.full_name, c?.credential_number, r.description];
        })
      );
      toast.success("Lost card report exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading) return <LoadingState message="Loading reports…" />;

  const reports = [
    { title: "Employee ID Register", desc: "All workforce identities", action: exportRegister },
    { title: "Card Inventory / Register", desc: "Credentials with QR/RFID", action: exportCards },
    { title: "Verification History", desc: "Scan audit trail", action: exportVerifications },
    { title: "Lost Card Report", desc: "Incidents & replacements", action: exportLost },
  ];

  return (
    <div>
      <PageHeader
        title="Credential Reports"
        description="ID register · inventory · printing · access · lost · expiry · security audit"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8 text-sm">
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Identities</p><p className="text-2xl font-bold">{summary.identities}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Cards (active)</p><p className="text-2xl font-bold">{summary.active} / {summary.cards}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Expired / Lost</p><p className="text-2xl font-bold">{summary.expired} / {summary.lost}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Blank stock</p><p className="text-2xl font-bold">{summary.inventory}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Print jobs</p><p className="text-2xl font-bold">{summary.prints}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-muted-foreground">Verifications / Incidents</p><p className="text-2xl font-bold">{summary.verifications} / {summary.incidents}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-teal-700" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{r.desc}</p>
              <Button size="sm" variant="outline" onClick={r.action}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
