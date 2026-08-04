"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";

export default function RegisterTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ job_code?: string; steps?: Array<{ key: string; label: string; status: string }> } | null>(null);
  const [form, setForm] = useState({
    organization_name: "",
    admin_email: "",
    admin_name: "",
    admin_password: "",
    country_code: "UG",
    currency: "UGX",
    plan_code: "starter",
    invite_code: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public/platform/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Provisioning failed");
      }
      const adminStep = (json.data?.steps || []).find(
        (s: { key: string; status: string; detail?: string }) =>
          s.key === "admin"
      );
      if (!adminStep || adminStep.status !== "completed") {
        throw new Error(
          adminStep?.detail ||
            "Administrator account could not be created. No one will be able to sign in."
        );
      }
      setDone(json.data);
      toast.success("Organization provisioned on SecureTrack ERP");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-hope-navy to-hope-teal p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <Shield className="h-10 w-10 text-hope-gold" />
          </div>
          <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
          <CardDescription>
            {APP_TAGLINE} · Auto-provision your tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Tenant ready</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Job <code className="text-xs">{done.job_code}</code>. Your company, modules,
                subscription, and setup wizard have been created.
              </p>
              <ul className="text-xs space-y-1 max-h-40 overflow-auto border rounded-md p-2">
                {(done.steps || []).map((s) => (
                  <li key={s.key} className="flex justify-between gap-2">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">{s.status}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Continue to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Organization name</Label>
                <Input
                  required
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  placeholder="Acme Manufacturing Ltd"
                />
              </div>
              <div>
                <Label>Administrator name</Label>
                <Input
                  value={form.admin_name}
                  onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label>Administrator email</Label>
                <Input
                  type="email"
                  required
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  placeholder="admin@acme.com"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                />
              </div>
              <div>
                <Label>Invite code (required when public signup is closed)</Label>
                <Input
                  value={form.invite_code}
                  onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
                  placeholder="From platform administrator"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Country</Label>
                  <Select
                    value={form.country_code}
                    onValueChange={(v) => setForm({ ...form, country_code: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UG">Uganda</SelectItem>
                      <SelectItem value="KE">Kenya</SelectItem>
                      <SelectItem value="TZ">Tanzania</SelectItem>
                      <SelectItem value="RW">Rwanda</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plan</Label>
                  <Select
                    value={form.plan_code}
                    onValueChange={(v) => setForm({ ...form, plan_code: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Provisioning…</>
                ) : (
                  <><Building2 className="h-4 w-4 mr-2" /> Create organization</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="underline">Sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
