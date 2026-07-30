import fs from "fs";
import path from "path";

const entities = [
  "headcount", "requisitions", "positions", "job-library", "vacancies", "stages",
  "candidates", "applications", "talent-pool", "referrals", "agencies", "campus",
  "assessments", "assessment-attempts", "interviews", "background", "references", "medical",
  "offers", "onboarding", "documents", "settings", "audit", "reports", "analytics",
];

// specialized (not pure entity)
const specialized = new Set(["ats", "live", "ai"]);

function entityPage(key) {
  return `"use client";

import { TaEntityPage } from "@/components/ta/ta-entity-page";
import { TA_ENTITIES } from "@/lib/ta/entities";

export default function Page() {
  const config = TA_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <TaEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "talent");
fs.mkdirSync(root, { recursive: true });

let n = 0;
for (const slug of entities) {
  if (specialized.has(slug)) continue;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), entityPage(slug), "utf8");
  n++;
}
console.log("Generated", n, "talent entity pages");
