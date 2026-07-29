"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Shift Management",
  description: "Shift templates hours breaks",
  table: "mes_shifts",
  numberField: "shift_code",
  numberPrefix: "SH",
  searchCols: ["shift_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "shift_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "shift_code", label: "Code / Number", required: true, autoNumber: "SH", createOnly: true },
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
