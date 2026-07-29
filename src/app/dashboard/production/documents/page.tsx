"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Documents",
  description: "SOPs manuals work instructions",
  table: "mes_work_instructions",
  numberField: "instruction_code",
  numberPrefix: "DOC",
  searchCols: ["instruction_code", "title", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['draft', 'active', 'archived'],
  columns: [
    { key: "instruction_code", label: "Code / Number" },
    { key: "title", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "instruction_code", label: "Code / Number", required: true, autoNumber: "DOC", createOnly: true },
    { key: "title", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['draft', 'active', 'archived'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "draft" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
