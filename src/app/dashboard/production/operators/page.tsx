"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Workers and Operators",
  description: "Skills shifts work centers",
  table: "mes_operators",
  numberField: "operator_code",
  numberPrefix: "OPR",
  searchCols: ["operator_code", "full_name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "operator_code", label: "Code / Number" },
    { key: "full_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "operator_code", label: "Code / Number", required: true, autoNumber: "OPR", createOnly: true },
    { key: "full_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
