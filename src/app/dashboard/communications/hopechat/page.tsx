"use client";
import { CommMessageList } from "@/components/communications/comm-message-list";
export default function Page() {
  return (
    <CommMessageList
      title="HopeChat Delivery"
      description="HopeChat notification bridge"
      channel={"hopechat"}
      statusFilter={undefined}
    />
  );
}