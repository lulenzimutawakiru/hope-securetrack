"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="In-App Notifications"
      description="ERP inbox fan-out messages"
      channel={"in_app"}
      statusFilter={undefined}
    />
  );
}