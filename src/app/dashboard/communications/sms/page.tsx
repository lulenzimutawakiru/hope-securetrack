"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="SMS Center"
      description="SMS gateway messages"
      channel={"sms"}
      statusFilter={undefined}
    />
  );
}