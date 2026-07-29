"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Quality Inspections",
  description: "Incoming in-process final QC",
  table: "mes_quality_inspections",
  numberField: "inspection_number",
  numberPrefix: "QI",
  searchCols: ["inspection_number", "result", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['pending', 'passed', 'failed', 'waived'],
  columns: [
    { key: "inspection_number", label: "Code / Number" },
    { key: "result", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "inspection_number", label: "Code / Number", required: true, autoNumber: "QI", createOnly: true },
    { key: "result", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['pending', 'passed', 'failed', 'waived'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "pending" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
