"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="SecureChat Delivery"
      description="SecureChat notification bridge"
      channel={"hopechat"}
      statusFilter={undefined}
    />
  );
}