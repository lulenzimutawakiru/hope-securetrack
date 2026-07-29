"use client";

import Link from "next/link";
import { Phone, Video, PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HopeChatCallsPage() {
  return (
    <div>
      <PageHeader
        title="Voice & Video Calls"
        description="1:1 · group · HD audio/video · screen share · blur · recording hooks"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
            <Button asChild size="sm"><Link href="/dashboard/chat/meetings"><Video className="h-4 w-4 mr-1" /> Meetings</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> Instant audio</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Start 1:1 or group voice from any DM or channel member list via WebRTC.</p>
            <Badge variant="outline">WebRTC</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Video className="h-4 w-4" /> Video conference</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>HD video rooms with waiting room, raise hand, captions, and breakout support hooks.</p>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat/meetings">Open rooms</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Call features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Screen sharing</li>
              <li>Background blur / virtual BG</li>
              <li>Recording + AI minutes</li>
              <li>Whiteboard & shared notes</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Call history appears alongside meetings. Schedule or start from <strong>Meetings</strong>, or dial
          colleagues from a DM once presence shows them online.
        </CardContent>
      </Card>
    </div>
  );
}
