"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Costing",
  description: "Material labor machine energy costs",
  table: "mes_cost_layers",
  numberField: "cost_type",
  numberPrefix: "COST",
  searchCols: ["cost_type", "cost_type", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "cost_type", label: "Code / Number" },
    { key: "cost_type", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "cost_type", label: "Code / Number", required: true, autoNumber: "COST", createOnly: true },
    { key: "cost_type", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
