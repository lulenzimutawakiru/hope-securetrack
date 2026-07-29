"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "MES Audit Logs",
  description: "Immutable production action trail",
  table: "mes_audit_log",
  numberField: "action",
  numberPrefix: "AUD",
  searchCols: ["action", "action", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "action", label: "Code / Number" },
    { key: "action", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "action", label: "Code / Number", required: true, autoNumber: "AUD", createOnly: true },
    { key: "action", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
