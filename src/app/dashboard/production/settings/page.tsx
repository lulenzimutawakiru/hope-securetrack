"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Settings",
  description: "Defaults OEE targets QR prefixes",
  table: "mes_settings",
  numberField: "setting_key",
  numberPrefix: "SET",
  searchCols: ["setting_key", "setting_key", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "setting_key", label: "Code / Number" },
    { key: "setting_key", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "setting_key", label: "Code / Number", required: true, autoNumber: "SET", createOnly: true },
    { key: "setting_key", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
