"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="Approval Request Communications"
      description="Workflow approval notifications"
      channel={undefined}
      statusFilter={undefined}
    />
  );
}