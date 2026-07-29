"use client";

import { MesEntityPage, type MesEntityConfig } from "@/components/mes/mes-entity-page";

const config: MesEntityConfig = {
  title: "IoT Devices",
  description: "Sensors meters protocols",
  table: "mes_iot_devices",
  numberField: "device_code",
  numberPrefix: "IOT",
  searchCols: ["device_code", "name", "product_name", "product_code", "status", "title", "full_name"],
  statusField: "status",
  statusOptions: ['online', 'offline', 'error'],
  columns: [
    { key: "device_code", label: "Code / Number" },
    { key: "name", label: "Name / Detail" },
    { key: "product_name", label: "Product" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Created" },
  ],
  fields: [
    { key: "device_code", label: "Code / Number", required: true, autoNumber: "IOT", createOnly: true },
    { key: "name", label: "Name / Title" },
    { key: "product_code", label: "Product code" },
    { key: "product_name", label: "Product name" },
    { key: "status", label: "Status", type: "select", options: ['online', 'offline', 'error'] },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  defaults: { status: "online" },
};

export default function Page() {
  return <MesEntityPage config={config} />;
}
