import fs from "fs";
import path from "path";

const entities = [
  "calendars",
  "periods",
  "grades",
  "bands",
  "scales",
  "groups",
  "commissions",
  "incentives",
  "shift-premiums",
  "formulas",
  "simulations",
  "corrections",
  "settlements",
  "cost-allocations",
  "mobile-money",
  "bank-files",
  "pension",
  "gratuity",
  "advances",
  "gl-mappings",
  "documents",
  "settings",
  "audit",
];

// Existing specialized pages — do not overwrite
const specialized = new Set([
  "runs",
  "profiles",
  "structures",
  "components",
  "tax",
  "overtime",
  "bonuses",
  "loans",
  "benefits",
  "approvals",
  "payments",
  "payslips",
  "self-service",
  "analytics",
  "ai",
  "workspace",
]);

function entityPage(key) {
  return `"use client";

import { PayEntityPage } from "@/components/payroll/pay-entity-page";
import { PAY_ENTITIES } from "@/lib/payroll/entities";

export default function Page() {
  const config = PAY_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <PayEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "payroll");
fs.mkdirSync(root, { recursive: true });

let n = 0;
for (const slug of entities) {
  if (specialized.has(slug)) continue;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), entityPage(slug), "utf8");
  n++;
}
console.log("Generated", n, "payroll entity pages");
