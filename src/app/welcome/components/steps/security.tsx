"use client";

import { useEffect } from "react";
import { ShieldCheck, KeyRound, Fingerprint, Globe2, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepHeader, SectionCard, Field, ToggleCard, type StepProps } from "../step-types";
import { toast } from "sonner";

export function SecurityStep({
  data,
  value,
  onPatchAnswers,
  registerSubmit,
  finishStep,
}: StepProps) {
  const v = value ?? {};
  const set = (key: string, val: unknown) => onPatchAnswers({ [key]: val });

  const submit = () => {
    if (v.mfa_required !== true) {
      toast.warning("We strongly recommend enforcing MFA — you can change this later in Security settings.");
    }
    finishStep();
  };

  useEffect(() => {
    registerSubmit(submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, data]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <StepHeader
        title="Security setup"
        description="Protect your organization with enterprise-grade identity controls. Defaults follow OWASP and ISO 27001 guidance and are enforced tenant-isolated."
        badge={
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" /> Zero-trust baseline
          </Badge>
        }
      />

      <SectionCard title="Administrators" description="The primary administrator was created during provisioning.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary admin email" hint="Used for security alerts and recovery.">
            <Input
              type="email"
              value={v.admin_email ?? data.summary.primary_contact_email ?? ""}
              onChange={(e) => set("admin_email", e.target.value)}
              placeholder="admin@company.com"
            />
          </Field>
          <Field label="Backup admin email">
            <Input
              type="email"
              value={v.backup_admin_email ?? ""}
              onChange={(e) => set("backup_admin_email", e.target.value)}
              placeholder="backup-admin@company.com"
            />
          </Field>
          <Field label="Emergency account email">
            <Input
              type="email"
              value={v.emergency_email ?? ""}
              onChange={(e) => set("emergency_email", e.target.value)}
              placeholder="emergency@company.com"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Access policies" description="These controls apply to every user in this tenant.">
        <div className="space-y-3">
          <ToggleCard
            title="Require MFA for administrators"
            description="Blocks credential theft. Enforced at sign-in and for privileged actions."
            checked={v.mfa_required === true}
            onChange={(val) => set("mfa_required", val)}
            badge={<Badge variant="outline">Recommended</Badge>}
          />
          <ToggleCard
            title="Enable passkeys"
            description="Passwordless, phishing-resistant sign-in on supported devices."
            checked={v.passkeys === true}
            onChange={(val) => set("passkeys", val)}
          />
          <ToggleCard
            title="Device trust"
            description="Require approved devices for admin sessions."
            checked={v.device_trust === true}
            onChange={(val) => set("device_trust", val)}
          />
          <ToggleCard
            title="IP restrictions"
            description="Restrict access to trusted networks (e.g. office VPN ranges)."
            checked={v.ip_restrictions === true}
            onChange={(val) => set("ip_restrictions", val)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Policies">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password policy">
            <Select value={v.password_policy ?? "strong"} onValueChange={(val) => set("password_policy", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard — 8+ characters</SelectItem>
                <SelectItem value="strong">Strong — 10+ chars, mixed case + symbols, 90-day expiry</SelectItem>
                <SelectItem value="enterprise">Enterprise — 14+ chars, history check, MFA enforced</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Session timeout">
            <Select value={v.session_timeout ?? "8h"} onValueChange={(val) => set("session_timeout", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30m">30 minutes</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="8h">8 hours (recommended)</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Single sign-on (SSO)">
            <Select value={v.sso ?? "none"} onValueChange={(val) => set("sso", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — SecureTrack accounts</SelectItem>
                <SelectItem value="oidc">OpenID Connect (Microsoft 365, Google)</SelectItem>
                <SelectItem value="saml">SAML 2.0 (Okta, Azure AD, ADFS)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Risk policy">
            <Select value={v.risk_policy ?? "standard"} onValueChange={(val) => set("risk_policy", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard — flag anomalies</SelectItem>
                <SelectItem value="strict">Strict — block unusual sign-ins</SelectItem>
                <SelectItem value="balanced">Balanced (recommended)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-medium text-foreground">Tenant isolation:</span> encryption keys, JWT secrets and
          audit logs for this tenant are separate from every other organization on the platform.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit}>
          <UserCog className="h-4 w-4 mr-2" /> Continue to Modules
        </Button>
      </div>
    </div>
  );
}