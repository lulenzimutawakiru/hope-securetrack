"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Machine Monitoring",
  description: "Live machine status board",
  table: "production_machines",
  numberField: "machine_code",
  numberPrefix: "MON",
  searchCols: ["machine_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['idle', 'running', 'maintenance', 'offline'],
  columns: [
    { key: "machine_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "machine_code", label: "Code / Number", required: true, autoNumber: "MON", createOnly: true },
    { key: "name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['idle', 'running', 'maintenance', 'offline'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "idle" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
