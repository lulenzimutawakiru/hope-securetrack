"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Rework Management",
  description: "Rework orders recovery completion",
  table: "mes_rework_orders",
  numberField: "rework_number",
  numberPrefix: "RW",
  searchCols: ["rework_number", "product_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['draft', 'approved', 'in_progress', 'completed', 'cancelled'],
  columns: [
    { key: "rework_number", label: "Code / Number" },
    { key: "product_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "rework_number", label: "Code / Number", required: true, autoNumber: "RW", createOnly: true },
    { key: "product_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['draft', 'approved', 'in_progress', 'completed', 'cancelled'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "draft" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
