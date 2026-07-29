"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="Push Notifications"
      description="Mobile and desktop push"
      channel={"push"}
      statusFilter={undefined}
    />
  );
}