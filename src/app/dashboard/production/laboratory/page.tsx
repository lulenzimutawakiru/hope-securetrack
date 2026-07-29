"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Laboratory",
  description: "Lab tests certificates sampling",
  table: "mes_quality_inspections",
  numberField: "inspection_number",
  numberPrefix: "LAB",
  searchCols: ["inspection_number", "result", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['pending', 'passed', 'failed'],
  columns: [
    { key: "inspection_number", label: "Code / Number" },
    { key: "result", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "inspection_number", label: "Code / Number", required: true, autoNumber: "LAB", createOnly: true },
    { key: "result", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['pending', 'passed', 'failed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "pending" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
