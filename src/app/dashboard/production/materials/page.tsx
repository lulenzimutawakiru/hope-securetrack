"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Material Requests",
  description: "Material issue requests for production",
  table: "mes_material_issues",
  numberField: "component_code",
  numberPrefix: "MR",
  searchCols: ["component_code", "component_name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "component_code", label: "Code / Number" },
    { key: "component_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "component_code", label: "Code / Number", required: true, autoNumber: "MR", createOnly: true },
    { key: "component_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
