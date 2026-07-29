"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Traceability Genealogy",
  description: "Batch lot recall chain",
  table: "mes_genealogy",
  numberField: "batch_number",
  numberPrefix: "TR",
  searchCols: ["batch_number", "product_code", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "batch_number", label: "Code / Number" },
    { key: "product_code", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "batch_number", label: "Code / Number", required: true, autoNumber: "TR", createOnly: true },
    { key: "product_code", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
