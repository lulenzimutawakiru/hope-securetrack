"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Waste Management",
  description: "Scrap waste reasons cost",
  table: "mes_waste_records",
  numberField: "waste_number",
  numberPrefix: "WST",
  searchCols: ["waste_number", "product_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['recorded', 'reviewed', 'closed'],
  columns: [
    { key: "waste_number", label: "Code / Number" },
    { key: "product_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "waste_number", label: "Code / Number", required: true, autoNumber: "WST", createOnly: true },
    { key: "product_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['recorded', 'reviewed', 'closed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "recorded" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
