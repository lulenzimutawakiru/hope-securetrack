import fs from "fs";
import path from "path";

const entities = [
  "portfolio", "programs", "list", "templates", "requests", "business-cases",
  "categories", "types", "wbs", "milestones", "deliverables", "tasks",
  "checklists", "dependencies", "sprints", "backlog", "roadmap", "resources",
  "allocations", "timesheets", "time-logs", "budgets", "expenses",
  "purchase-requests", "documents", "changes", "risks", "issues", "decisions",
  "lessons", "meetings", "inspections", "ncr", "invoices", "claims",
  "retentions", "revenue", "assets", "inventory", "approvals", "notifications",
  "settings", "audit", "baselines", "calendar",
];

const aliases = {
  lifecycle: "list",
  timeline: "tasks",
  subtasks: "tasks",
  "critical-path": "dependencies",
  "agile-boards": "tasks",
  capacity: "resources",
  costing: "budgets",
  drawings: "documents",
  contracts: "documents",
  quality: "inspections",
  billing: "invoices",
  "customer-portal": "list",
  "supplier-portal": "purchase-requests",
};

function pageContent(key) {
  return `"use client";

import { PpmEntityPage } from "@/components/ppm/ppm-entity-page";
import { PPM_ENTITIES } from "@/lib/ppm/entities";

export default function Page() {
  const config = PPM_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <PpmEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "projects");
fs.mkdirSync(root, { recursive: true });

const all = [...entities, ...Object.keys(aliases)];
for (const slug of all) {
  const key = aliases[slug] || slug;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), pageContent(key), "utf8");
}
console.log("Generated", all.length, "PPM entity pages");
