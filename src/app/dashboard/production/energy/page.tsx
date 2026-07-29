"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Energy and Utilities",
  description: "Electricity water gas readings",
  table: "mes_energy_readings",
  numberField: "reading_type",
  numberPrefix: "EN",
  searchCols: ["reading_type", "reading_type", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "reading_type", label: "Code / Number" },
    { key: "reading_type", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "reading_type", label: "Code / Number", required: true, autoNumber: "EN", createOnly: true },
    { key: "reading_type", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
