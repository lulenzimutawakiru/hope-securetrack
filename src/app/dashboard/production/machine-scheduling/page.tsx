"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Machine Scheduling",
  description: "Assign jobs to machines",
  table: "mes_work_orders",
  numberField: "work_order_number",
  numberPrefix: "WO",
  searchCols: ["work_order_number", "operation_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['pending', 'ready', 'running', 'paused', 'completed'],
  columns: [
    { key: "work_order_number", label: "Code / Number" },
    { key: "operation_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "work_order_number", label: "Code / Number", required: true, autoNumber: "WO", createOnly: true },
    { key: "operation_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['pending', 'ready', 'running', 'paused', 'completed'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "pending" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
