"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Packaging Orders",
  description: "Cartons pallets packaging lines",
  table: "mes_packaging_orders",
  numberField: "packaging_number",
  numberPrefix: "PKG",
  searchCols: ["packaging_number", "product_name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['draft', 'released', 'in_progress', 'completed', 'cancelled'],
  columns: [
    { key: "packaging_number", label: "Code / Number" },
    { key: "product_name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "packaging_number", label: "Code / Number", required: true, autoNumber: "PKG", createOnly: true },
    { key: "packaging_line", label: "Packaging line" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['draft', 'released', 'in_progress', 'completed', 'cancelled'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "draft" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
