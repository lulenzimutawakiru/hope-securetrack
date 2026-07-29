"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Machine Maintenance",
  description: "PM corrective predictive orders",
  table: "mes_maintenance_orders",
  numberField: "order_number",
  numberPrefix: "MO",
  searchCols: ["order_number", "title", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['open', 'scheduled', 'in_progress', 'completed'],
  columns: [
    { key: "order_number", label: "Code / Number" },
    { key: "title", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "order_number", label: "Code / Number", required: true, autoNumber: "MO", createOnly: true },
    { key: "title", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['open', 'scheduled', 'in_progress', 'completed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "open" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
