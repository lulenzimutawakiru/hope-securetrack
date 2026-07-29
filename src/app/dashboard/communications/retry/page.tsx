"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="Failed / Retry Queue"
      description="Failed deliveries and retry actions"
      channel={undefined}
      statusFilter={"failed"}
    />
  );
}