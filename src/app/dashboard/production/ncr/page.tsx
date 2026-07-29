"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "NCR and Rejects",
  description: "Non-conformance CAPA rejects",
  table: "mes_ncr",
  numberField: "ncr_number",
  numberPrefix: "NCR",
  searchCols: ["ncr_number", "title", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['open', 'investigating', 'closed'],
  columns: [
    { key: "ncr_number", label: "Code / Number" },
    { key: "title", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "ncr_number", label: "Code / Number", required: true, autoNumber: "NCR", createOnly: true },
    { key: "title", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['open', 'investigating', 'closed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "open" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
