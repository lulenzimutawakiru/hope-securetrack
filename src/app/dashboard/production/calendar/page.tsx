"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Calendar",
  description: "Shutdowns shifts planned production windows",
  table: "mes_production_plans",
  numberField: "plan_number",
  numberPrefix: "CAL",
  searchCols: ["plan_number", "plan_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['draft', 'approved', 'scheduled', 'completed'],
  columns: [
    { key: "plan_number", label: "Code / Number" },
    { key: "plan_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "plan_number", label: "Code / Number", required: true, autoNumber: "CAL", createOnly: true },
    { key: "plan_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['draft', 'approved', 'scheduled', 'completed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "draft" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
