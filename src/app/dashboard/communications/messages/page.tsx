"use client";

import { CommMessageList } from "@/components/communications/comm-message-list";

export default function AllMessagesPage() {
  return (
    <CommMessageList
      title="All messages"
      description="Unified outbox across email, SMS, WhatsApp, push, in-app and HopeChat — drill into any message"
    />
  );
}
