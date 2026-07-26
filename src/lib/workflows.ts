/**
 * Enterprise workflow helpers — keep UI pages thin.
 */

export type WorkflowStage =
  | "production"
  | "qr"
  | "print"
  | "pack"
  | "warehouse"
  | "sales"
  | "invoice"
  | "dispatch"
  | "delivered";

export const ENTERPRISE_PIPELINE: {
  stage: WorkflowStage;
  title: string;
  href: string;
  description: string;
}[] = [
  {
    stage: "production",
    title: "1. Production batch",
    href: "/dashboard/production",
    description: "Create manufacturing batch with product & quantity",
  },
  {
    stage: "qr",
    title: "2. Generate QR",
    href: "/dashboard/qr-codes",
    description: "Issue signed SecureTrack codes per unit",
  },
  {
    stage: "print",
    title: "3. Print labels",
    href: "/dashboard/labels",
    description: "Niimbot / browser labels with verify QR",
  },
  {
    stage: "pack",
    title: "4. Pack cartons",
    href: "/dashboard/packing",
    description: "5 reams → carton validation",
  },
  {
    stage: "warehouse",
    title: "5. Warehouse",
    href: "/dashboard/inventory",
    description: "Receive stock, track movements",
  },
  {
    stage: "sales",
    title: "6. Sales order",
    href: "/dashboard/sales",
    description: "Customer order & commercial terms",
  },
  {
    stage: "invoice",
    title: "7. Invoice",
    href: "/dashboard/invoices",
    description: "Issue invoice & collect payment",
  },
  {
    stage: "dispatch",
    title: "8. Dispatch",
    href: "/dashboard/dispatch",
    description: "Ship to distributor / customer",
  },
];

export function moneyKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}
