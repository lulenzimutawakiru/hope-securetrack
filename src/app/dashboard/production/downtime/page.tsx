"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Downtime Management",
  description: "Downtime events root causes",
  table: "mes_downtime",
  numberField: "reason_code",
  numberPrefix: "DT",
  searchCols: ["reason_code", "reason_code", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "reason_code", label: "Code / Number" },
    { key: "reason_code", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "reason_code", label: "Code / Number", required: true, autoNumber: "DT", createOnly: true },
    { key: "reason_code", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
