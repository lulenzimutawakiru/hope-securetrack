"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Routing Steps",
  description: "Operation sequence setup run times",
  table: "mes_routing_operations",
  numberField: "operation_name",
  numberPrefix: "OP",
  searchCols: ["operation_name", "operation_name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "operation_name", label: "Code / Number" },
    { key: "operation_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "operation_name", label: "Code / Number", required: true, autoNumber: "OP", createOnly: true },
    { key: "operation_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
