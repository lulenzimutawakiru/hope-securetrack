"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="WhatsApp Center"
      description="WhatsApp Business messages"
      channel={"whatsapp"}
      statusFilter={undefined}
    />
  );
}