"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Machine Groups",
  description: "Group machines for capacity planning",
  table: "mes_machine_groups",
  numberField: "group_code",
  numberPrefix: "GRP",
  searchCols: ["group_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  
  
  columns: [
    { key: "group_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "group_code", label: "Code / Number", required: true, autoNumber: "GRP", createOnly: true },
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
