export type ContractDomain =
  | "sales"
  | "billing"
  | "crm"
  | "procurement"
  | "government";

export const CONTRACT_DOMAINS: Array<{
  key: ContractDomain;
  title: string;
  description: string;
  table: string;
  href: string;
  legacyHref: string;
  numberKey: string;
  titleKey: string;
  valueKey: string;
  partyKey: string;
}> = [
  {
    key: "sales",
    title: "Sales contracts",
    description: "Framework · blanket · tender · distributor",
    table: "sales_contracts",
    href: "/dashboard/contracts/sales",
    legacyHref: "/dashboard/sales/contracts",
    numberKey: "contract_number",
    titleKey: "name",
    valueKey: "contract_value",
    partyKey: "customer_name",
  },
  {
    key: "billing",
    title: "Billing contracts",
    description: "Service · SLA · subscription · milestones",
    table: "bill_contracts",
    href: "/dashboard/contracts/billing",
    legacyHref: "/dashboard/billing/contracts",
    numberKey: "contract_number",
    titleKey: "title",
    valueKey: "total_value",
    partyKey: "customer_name",
  },
  {
    key: "crm",
    title: "CRM contracts",
    description: "Customer commercial agreements",
    table: "crm_contracts",
    href: "/dashboard/contracts/crm",
    legacyHref: "/dashboard/crm/contracts",
    numberKey: "contract_number",
    titleKey: "title",
    valueKey: "value",
    partyKey: "customer_name",
  },
  {
    key: "procurement",
    title: "Procurement contracts",
    description: "Supplier framework · blanket · service",
    table: "procurement_contracts",
    href: "/dashboard/contracts/procurement",
    legacyHref: "/dashboard/procurement/contracts",
    numberKey: "contract_number",
    titleKey: "title",
    valueKey: "value_limit",
    partyKey: "supplier_name",
  },
  {
    key: "government",
    title: "Government contracts",
    description: "Public sector revenue contracts",
    table: "fin_government_contracts",
    href: "/dashboard/contracts/government",
    legacyHref: "/dashboard/finance/gov-contracts",
    numberKey: "contract_number",
    titleKey: "agency_name",
    valueKey: "contract_value",
    partyKey: "agency_name",
  },
];

export const CONTRACTS_MENU = [
  { title: "Contracts Hub", href: "/dashboard/contracts", group: "Overview" },
  { title: "Expiring soon", href: "/dashboard/contracts/expiring", group: "Overview" },
  { title: "Analytics", href: "/dashboard/contracts/analytics", group: "Overview" },
  { title: "Sales contracts", href: "/dashboard/contracts/sales", group: "Domains" },
  { title: "Billing contracts", href: "/dashboard/contracts/billing", group: "Domains" },
  { title: "CRM contracts", href: "/dashboard/contracts/crm", group: "Domains" },
  { title: "Procurement contracts", href: "/dashboard/contracts/procurement", group: "Domains" },
  { title: "Government contracts", href: "/dashboard/contracts/government", group: "Domains" },
  { title: "Sales contract lines", href: "/dashboard/sales/contract-lines", group: "Lines" },
  { title: "Sales rebates", href: "/dashboard/sales/rebates", group: "Lines" },
  { title: "Projects contracts", href: "/dashboard/projects/contracts", group: "Related" },
] as const;

export type ContractStats = {
  total: number;
  active: number;
  draft: number;
  expiring: number;
  expired: number;
  totalValue: number;
  byDomain: Array<{ domain: ContractDomain; count: number; value: number }>;
};
