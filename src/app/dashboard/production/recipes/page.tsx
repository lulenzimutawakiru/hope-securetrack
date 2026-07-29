"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Recipes and Formulas",
  description: "Formula management multi-level recipes",
  table: "bom_headers",
  numberField: "bom_code",
  numberPrefix: "RCP",
  searchCols: ["bom_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['draft', 'active', 'obsolete'],
  columns: [
    { key: "bom_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "bom_code", label: "Code / Number", required: true, autoNumber: "RCP", createOnly: true },
    { key: "name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['draft', 'active', 'obsolete'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "draft" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
