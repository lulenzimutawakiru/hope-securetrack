"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Palletization",
  description: "Pallet build master QR",
  table: "mes_packaging_units",
  numberField: "unit_code",
  numberPrefix: "PLT",
  searchCols: ["unit_code", "unit_type", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "unit_code", label: "Code / Number" },
    { key: "unit_type", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "unit_code", label: "Code / Number", required: true, autoNumber: "PLT", createOnly: true },
    { key: "unit_type", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
