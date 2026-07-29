import { CommSubnav } from "@/components/communications/comm-subnav";

export default function CommunicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <CommSubnav />
      {children}
    </div>
  );
}
