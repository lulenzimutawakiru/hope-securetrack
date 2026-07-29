"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Cpu } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listBiometricProfiles,
  listBiometricDevices,
  enrollBiometric,
  listPersonsByLifecycle,
  BIOMETRIC_MODALITIES,
  BIOMETRIC_VENDORS,
  getDigitalIdentityStats,
} from "@/lib/digital-identity";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function BiometricsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [persons, setPersons] = useState<Array<Record<string, unknown>>>([]);
  const [personId, setPersonId] = useState("");
  const [modality, setModality] = useState("fingerprint");
  const [vendor, setVendor] = useState("zkteco");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!auth) return;
    try {
      const [p, d, people, s] = await Promise.all([
        listBiometricProfiles(),
        listBiometricDevices(auth.profile.company_id),
        listPersonsByLifecycle({ limit: 200 }),
        getDigitalIdentityStats(),
      ]);
      setProfiles(p as Array<Record<string, unknown>>);
      setDevices(d as Array<Record<string, unknown>>);
      setPersons(people as Array<Record<string, unknown>>);
      setCount(s.biometrics);
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth]);

  const enroll = async () => {
    if (!auth || !personId) {
      toast.error("Select a person");
      return;
    }
    setBusy(true);
    try {
      await enrollBiometric({
        company_id: auth.profile.company_id,
        person_id: personId,
        modality,
        vendor,
      });
      toast.success(`Enrolled ${modality} (${vendor})`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading biometric identity…" />;

  return (
    <div>
      <PageHeader
        title="Biometric Identity"
        description="Fingerprint · face · iris · palm · voice · ZKTeco · Suprema · Hikvision · Anviz · Dahua"
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id as string} value={p.id as string}>
                    {String(p.display_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modality} onValueChange={setModality}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BIOMETRIC_MODALITIES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BIOMETRIC_VENDORS.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={enroll} disabled={busy}>
              <Fingerprint className="h-4 w-4 mr-1" /> Enroll
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Active enrollments" value={String(count)} icon={Fingerprint} />
        <StatCard title="Devices" value={String(devices.length)} icon={Cpu} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-2">Enrollments</h3>
          {profiles.length === 0 ? (
            <EmptyState title="No biometric profiles" description="Enroll fingerprints or face templates." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Modality</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const person = p.uw_persons as Record<string, unknown> | null;
                    return (
                      <TableRow key={p.id as string}>
                        <TableCell className="text-sm">
                          {person ? String(person.display_name) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{String(p.modality)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{String(p.vendor)}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(p.enrolled_at))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Biometric devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices registered.</p>
            ) : (
              devices.map((d) => (
                <div key={d.id as string} className="rounded border px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{String(d.name)}</span>
                    <Badge variant="outline" className="text-[10px]">{String(d.vendor)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {String(d.device_code)} · {String(d.location || "—")}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {((d.modalities as string[]) || []).map((m) => (
                      <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
