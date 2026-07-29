import fs from "fs";
import path from "path";

const entities = Object.keys({
  "account-groups": 1,
  dimensions: 1,
  "profit-centers": 1,
  "business-units": 1,
  "fiscal-years": 1,
  "journal-templates": 1,
  "recurring-journals": 1,
  "posting-batches": 1,
  "trial-balance": 1,
  "period-locks": 1,
  "ar-credit-notes": 1,
  "ar-debit-notes": 1,
  receipts: 1,
  collections: 1,
  "payment-plans": 1,
  "customer-statements": 1,
  "recurring-invoices": 1,
  "ap-invoices": 1,
  "ap-credit-notes": 1,
  "ap-debit-notes": 1,
  "payment-runs": 1,
  "supplier-statements": 1,
  "supplier-recon": 1,
  banks: 1,
  "bank-statements": 1,
  "bank-recon": 1,
  "electronic-payments": 1,
  "petty-cash": 1,
  "cash-forecast": 1,
  liquidity: 1,
  investments: 1,
  loans: 1,
  "letters-of-credit": 1,
  guarantees: 1,
  "budget-templates": 1,
  "budget-revisions": 1,
  "budget-variance": 1,
  forecasts: 1,
  "costing-methods": 1,
  "standard-costs": 1,
  "cost-rolls": 1,
  "cost-variances": 1,
  wip: 1,
  "tax-returns": 1,
  wht: 1,
  "tax-jurisdictions": 1,
  intercompany: 1,
  eliminations: 1,
  notifications: 1,
  settings: 1,
  audit: 1,
  "mobile-money": 1,
});

const aliases = {
  "journal-entries": "journal-templates",
  "closing-periods": "period-locks",
  "ar-invoices": "customer-statements",
  "customer-aging": "customer-statements",
  "supplier-aging": "supplier-statements",
  "swift-eft": "electronic-payments",
  debt: "loans",
  "dept-budgets": "budget-templates",
  "project-budgets": "budget-templates",
  "production-budgets": "budget-templates",
  "forecast-revenue": "forecasts",
  "forecast-expense": "forecasts",
  "forecast-cash": "forecasts",
  "forecast-ai": "forecasts",
  "my-finance": "notifications",
};

function pageContent(key) {
  return `"use client";

import { FinEntityPage } from "@/components/finance/fin-entity-page";
import { FIN_ENTITIES } from "@/lib/finance/entities";

export default function Page() {
  const config = FIN_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <FinEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "finance");
const all = [...entities, ...Object.keys(aliases)];
let n = 0;
for (const slug of all) {
  const key = aliases[slug] || slug;
  // do not overwrite specialized existing pages that are not pure entity pages
  const skip = new Set([
    "page.tsx", // hub is not a slug folder
  ]);
  const dir = path.join(root, slug);
  const pagePath = path.join(dir, "page.tsx");
  // keep hand-built specialist pages
  const specialists = new Set([
    "cfo", "coa", "journals", "ar", "ap", "bank", "cash", "treasury", "budgets",
    "cost-centres", "costing", "assets", "tax", "approvals", "periods", "ai",
    "reports", "mobile",
  ]);
  if (specialists.has(slug)) continue;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pagePath, pageContent(key), "utf8");
  n++;
}
console.log("Generated", n, "finance entity pages");
