import fs from "fs";
import path from "path";

const entities = [
  "vehicles", "categories", "types", "brands", "models", "documents", "photos", "assignments",
  "drivers", "licenses", "certifications", "training", "medicals", "violations", "driver-performance", "attendance",
  "gps-devices", "gps-locations", "geofences", "trips", "trip-requests", "routes", "dispatch", "deliveries", "pod",
  "containers", "cargo", "fuel-stations", "fuel-cards", "fuel-requests", "fuel-issuance", "fuel-consumption",
  "pm", "work-orders", "repairs", "workshops", "mechanics", "spare-parts", "tyres", "batteries",
  "insurance", "road-licenses", "inspections", "accidents", "claims", "odometer", "costs", "iot", "telematics",
  "approvals", "notifications", "settings", "audit",
];

const aliases = {
  ownership: "vehicles",
  "qr-tags": "vehicles",
  "asset-tags": "vehicles",
  "route-tracking": "routes",
  "trip-planner": "trips",
  "customer-deliveries": "deliveries",
  "supplier-pickups": "deliveries",
  "production-transport": "dispatch",
  "warehouse-logistics": "dispatch",
  corrective: "work-orders",
  maintenance: "work-orders",
  "service-history": "work-orders",
  mileage: "odometer",
  inventory: "spare-parts",
  "employee-allocation": "assignments",
  "department-allocation": "assignments",
  "project-allocation": "assignments",
  incidents: "accidents",
  speed: "telematics",
  engine: "telematics",
  temperature: "telematics",
  "driver-behavior": "telematics",
  "fuel-analytics": "fuel-issuance",
};

function pageContent(key) {
  return `"use client";

import { FleetEntityPage } from "@/components/fleet/fleet-entity-page";
import { FLEET_ENTITIES } from "@/lib/fleet/entities";

export default function Page() {
  const config = FLEET_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <FleetEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "fleet");
fs.mkdirSync(root, { recursive: true });

const all = [...entities, ...Object.keys(aliases)];
for (const slug of all) {
  const key = aliases[slug] || slug;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), pageContent(key), "utf8");
}
console.log("Generated", all.length, "entity pages");
