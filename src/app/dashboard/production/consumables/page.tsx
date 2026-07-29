"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Consumables",
  description: "Shop supplies reorder points",
  table: "mes_consumables",
  numberField: "item_code",
  numberPrefix: "CON",
  searchCols: ["item_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "item_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "item_code", label: "Code / Number", required: true, autoNumber: "CON", createOnly: true },
    { key: "name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
