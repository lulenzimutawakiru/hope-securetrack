"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "Job Cards",
  description: "Operator job cards start pause complete",
  table: "mes_job_cards",
  numberField: "job_number",
  numberPrefix: "JOB",
  searchCols: ["job_number", "instructions", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['open', 'running', 'paused', 'completed', 'cancelled'],
  columns: [
    { key: "job_number", label: "Code / Number" },
    { key: "instructions", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "job_number", label: "Code / Number", required: true, autoNumber: "JOB", createOnly: true },
    { key: "instructions", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['open', 'running', 'paused', 'completed', 'cancelled'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "open" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
