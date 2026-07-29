"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Analytics",
  description: "Trends utilization scrap rates",
  table: "mes_oee_snapshots",
  numberField: "snapshot_date",
  numberPrefix: "AN",
  searchCols: ["snapshot_date", "work_center_name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "snapshot_date", label: "Code / Number" },
    { key: "work_center_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "snapshot_date", label: "Code / Number", required: true, autoNumber: "AN", createOnly: true },
    { key: "work_center_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
