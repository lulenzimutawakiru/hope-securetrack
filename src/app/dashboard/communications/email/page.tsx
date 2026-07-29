"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="Email Center"
      description="Branded email outbox with delivery tracking"
      channel={"email"}
      statusFilter={undefined}
    />
  );
}