"use client";

import Link from "next/link";
import { ControlPlaneSectionPage } from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformNotificationsPage() {
  return (
    <ControlPlaneSectionPage
      title="Notification Center"
      description="Email, SMS, push, WhatsApp, Slack, Teams — templates and triggers"
      capabilityId="notifications"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channels</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Resend email · Africa&apos;s Talking SMS · WhatsApp · FCM/OneSignal · Slack</p>
          <p>Outbox + job_queue email.send for durable delivery</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/settings/email">ERP email settings</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/integrations">Integrations</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </ControlPlaneSectionPage>
  );
}
