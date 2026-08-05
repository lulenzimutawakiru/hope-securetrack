"use client";

import Link from "next/link";
import { Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { name: "Payments", items: "Stripe · Flutterwave · Pesapal · MTN MoMo · Airtel" },
  { name: "Comms", items: "Resend · Africa's Talking · WhatsApp · Push" },
  { name: "Identity", items: "SSO/OIDC · SCIM · MFA (Supabase Auth)" },
  { name: "Ops", items: "Upstash Redis · QStash · Sentry · Slack" },
  { name: "Maps / AI", items: "Mapbox · LLM gateway · Document AI" },
];

export default function PlatformIntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="External providers and webhooks for the SecureTrack estate"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/integrations">ERP integrations</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <Card key={p.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plug className="h-4 w-4" /> {p.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {p.items}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-2">
          <p>
            Provider keys live only in server environment variables (never
            NEXT_PUBLIC_). Sandbox defaults apply when keys are missing.
          </p>
          <p>
            Webhooks: <code className="text-xs">/api/public/billing/webhooks/*</code>{" "}
            and service-desk inbound routes require signature verification.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/health">Health / config posture</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/ops">Ops</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
