"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Serial Numbers",
  description: "Unit carton pallet serialization",
  table: "mes_serial_numbers",
  numberField: "serial_value",
  numberPrefix: "SN",
  searchCols: ["serial_value", "product_code", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['active', 'shipped', 'recalled', 'void'],
  columns: [
    { key: "serial_value", label: "Code / Number" },
    { key: "product_code", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "serial_value", label: "Code / Number", required: true, autoNumber: "SN", createOnly: true },
    { key: "product_code", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['active', 'shipped', 'recalled', 'void'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "active" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
