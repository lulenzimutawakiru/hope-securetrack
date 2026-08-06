"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  Shield,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  User,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/security/turnstile";
import { COUNTRY_DEFAULTS, validateAdminPassword } from "@/lib/platform/onboarding";

type RegisterConfig = {
  public_enabled: boolean;
  invite_required: boolean;
  signups_enabled: boolean;
  captcha_required: boolean;
  captcha_site_key: string | null;
};

const STEPS = [
  { id: 0, title: "Organization", icon: Building2 },
  { id: 1, title: "Administrator", icon: User },
  { id: 2, title: "Security", icon: Lock },
] as const;

const INDUSTRIES = [
  "Manufacturing",
  "Distribution",
  "Retail",
  "Healthcare",
  "Government",
  "Professional services",
  "Agriculture",
  "Technology",
  "Other",
];

export default function RegisterTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<RegisterConfig | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [done, setDone] = useState<{
    job_code?: string;
    setup_path?: string;
    steps?: Array<{ key: string; label: string; status: string }>;
  } | null>(null);
  const [form, setForm] = useState({
    organization_name: "",
    industry: "Manufacturing",
    admin_email: "",
    admin_name: "",
    admin_password: "",
    admin_password_confirm: "",
    country_code: "UG",
    currency: "UGX",
    plan_code: "starter",
    invite_code: "",
  });

  useEffect(() => {
    fetch("/api/public/platform/provision")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.data) setConfig(json.data as RegisterConfig);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const d = COUNTRY_DEFAULTS[form.country_code];
    if (d) setForm((f) => ({ ...f, currency: d.currency }));
  }, [form.country_code]);

  const pwd = useMemo(
    () => validateAdminPassword(form.admin_password),
    [form.admin_password]
  );

  const canNextOrg =
    form.organization_name.trim().length >= 2 && form.country_code.length >= 2;
  const canNextAdmin =
    form.admin_name.trim().length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email);
  const canSubmit =
    pwd.ok &&
    form.admin_password === form.admin_password_confirm &&
    (!config?.invite_required || form.invite_code.trim().length > 0) &&
    (!config?.captcha_required || Boolean(captchaToken));

  // Server reports signups closed (public off AND no invite secret configured)
  const signupsClosed = Boolean(
    config &&
      (config.signups_enabled === false ||
        (!config.public_enabled && !config.invite_required))
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupsClosed) {
      toast.error("New signups are currently disabled on this platform");
      return;
    }
    if (!canSubmit) {
      if (!pwd.ok) toast.error(pwd.errors[0]);
      else if (form.admin_password !== form.admin_password_confirm) {
        toast.error("Passwords do not match");
      } else if (config?.captcha_required && !captchaToken) {
        toast.error("Complete CAPTCHA to continue");
      } else if (config?.invite_required && !form.invite_code.trim()) {
        toast.error("Invite code is required");
      }
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/platform/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: form.organization_name.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          admin_name: form.admin_name.trim(),
          admin_password: form.admin_password,
          country_code: form.country_code,
          currency: form.currency,
          industry: form.industry,
          plan_code: form.plan_code,
          invite_code: form.invite_code || undefined,
          captcha_token: captchaToken || undefined,
        }),
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
            {APP_TAGLINE} · Create your organization
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
                Job <code className="text-xs">{done.job_code}</code>. Your company,
                modules, security defaults, and setup wizard are ready.
              </p>
              <ul className="text-xs space-y-1 max-h-40 overflow-auto border rounded-md p-2">
                {(done.steps || []).map((s) => (
                  <li key={s.key} className="flex justify-between gap-2">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">{s.status}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> After sign-in
                </p>
                <p>
                  Complete the go-live wizard at{" "}
                  <code className="text-[11px]">
                    {done.setup_path || "/dashboard/settings/setup"}
                  </code>{" "}
                  — branding, team invites, and company details.
                </p>
              </div>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Continue to sign in
              </Button>
            </div>
          ) : signupsClosed ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">
                  New signups are currently disabled
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Registration on this platform is temporarily closed. If you
                  already have an account, sign in below.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/login")}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const active = step === i;
                  const doneStep = step > i;
                  return (
                    <div
                      key={s.id}
                      className={`flex-1 flex flex-col items-center gap-1 text-[10px] ${
                        active
                          ? "text-foreground"
                          : doneStep
                            ? "text-hope-teal"
                            : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center border ${
                          active
                            ? "border-primary bg-primary/10"
                            : doneStep
                              ? "border-hope-teal bg-hope-teal/10"
                              : "border-muted"
                        }`}
                      >
                        {doneStep ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <span className="font-medium">{s.title}</span>
                    </div>
                  );
                })}
              </div>

              {step === 0 && (
                <div className="space-y-3">
                  <div>
                    <Label>Organization name</Label>
                    <Input
                      required
                      value={form.organization_name}
                      onChange={(e) =>
                        setForm({ ...form, organization_name: e.target.value })
                      }
                      placeholder="Acme Manufacturing Ltd"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>Industry</Label>
                    <Select
                      value={form.industry}
                      onValueChange={(v) => setForm({ ...form, industry: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Country</Label>
                      <Select
                        value={form.country_code}
                        onValueChange={(v) =>
                          setForm({ ...form, country_code: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COUNTRY_DEFAULTS).map(
                            ([code, d]) => (
                              <SelectItem key={code} value={code}>
                                {d.countryName}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <Select
                        value={form.plan_code}
                        onValueChange={(v) =>
                          setForm({ ...form, plan_code: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">
                            Starter (30-day trial)
                          </SelectItem>
                          <SelectItem value="professional">
                            Professional
                          </SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Currency defaults to <strong>{form.currency}</strong> for
                    your country (change later in settings).
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <div>
                    <Label>Administrator name</Label>
                    <Input
                      required
                      value={form.admin_name}
                      onChange={(e) =>
                        setForm({ ...form, admin_name: e.target.value })
                      }
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>Administrator email</Label>
                    <Input
                      type="email"
                      required
                      value={form.admin_email}
                      onChange={(e) =>
                        setForm({ ...form, admin_email: e.target.value })
                      }
                      placeholder="admin@acme.com"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This email is used for sign-in and platform notices. It must
                    not already exist on SecureTrack.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      required
                      minLength={10}
                      value={form.admin_password}
                      onChange={(e) =>
                        setForm({ ...form, admin_password: e.target.value })
                      }
                      autoFocus
                      autoComplete="new-password"
                    />
                    {form.admin_password && (
                      <ul className="mt-1.5 space-y-0.5 text-[11px]">
                        {[
                          "At least 10 characters",
                          "Uppercase letter",
                          "Lowercase letter",
                          "Number",
                          "Special character",
                        ].map((rule, i) => {
                          const ok = [
                            form.admin_password.length >= 10,
                            /[A-Z]/.test(form.admin_password),
                            /[a-z]/.test(form.admin_password),
                            /[0-9]/.test(form.admin_password),
                            /[^A-Za-z0-9]/.test(form.admin_password),
                          ][i];
                          return (
                            <li
                              key={rule}
                              className={
                                ok
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {ok ? "✓" : "○"} {rule}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <Label>Confirm password</Label>
                    <Input
                      type="password"
                      required
                      minLength={10}
                      value={form.admin_password_confirm}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          admin_password_confirm: e.target.value,
                        })
                      }
                      autoComplete="new-password"
                    />
                  </div>
                  {(config?.invite_required || !config?.public_enabled) && (
                    <div>
                      <Label>
                        Invite code
                        {config?.invite_required ? " (required)" : " (optional)"}
                      </Label>
                      <Input
                        value={form.invite_code}
                        onChange={(e) =>
                          setForm({ ...form, invite_code: e.target.value })
                        }
                        placeholder="From platform administrator"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  {config?.captcha_required && config.captcha_site_key && (
                    <div className="flex justify-center">
                      <TurnstileWidget
                        siteKey={config.captcha_site_key}
                        onToken={setCaptchaToken}
                        onExpire={() => setCaptchaToken("")}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep((s) => s - 1)}
                    disabled={loading}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                ) : null}
                {step < 2 ? (
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={
                      (step === 0 && !canNextOrg) ||
                      (step === 1 && !canNextAdmin)
                    }
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || !canSubmit}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                        Provisioning…
                      </>
                    ) : (
                      <>
                        <Building2 className="h-4 w-4 mr-2" /> Create
                        organization
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
