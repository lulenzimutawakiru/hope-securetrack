import { ContractsSubnav } from "@/components/contracts/contracts-subnav";

export default function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <ContractsSubnav />
      {children}
    </div>
  );
}
