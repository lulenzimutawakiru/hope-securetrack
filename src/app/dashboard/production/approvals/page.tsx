"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Production Approvals",
  description: "Orders plans awaiting approval",
  table: "mes_production_orders",
  numberField: "order_number",
  numberPrefix: "APR",
  searchCols: ["order_number", "product_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['planned', 'released'],
  columns: [
    { key: "order_number", label: "Code / Number" },
    { key: "product_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "order_number", label: "Code / Number", required: true, autoNumber: "APR", createOnly: true },
    { key: "product_name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['planned', 'released'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "planned" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
