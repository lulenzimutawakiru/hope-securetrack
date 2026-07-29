"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Labels and QR Printing",
  description: "Product carton pallet labels",
  table: "mes_labels",
  numberField: "label_number",
  numberPrefix: "LBL",
  searchCols: ["label_number", "label_type", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['ready', 'printed', 'void'],
  columns: [
    { key: "label_number", label: "Code / Number" },
    { key: "label_type", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "label_number", label: "Code / Number", required: true, autoNumber: "LBL", createOnly: true },
    { key: "label_type", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['ready', 'printed', 'void'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "ready" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
