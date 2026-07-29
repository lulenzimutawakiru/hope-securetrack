/** Enterprise Dispatch & Delivery types */

export const DISPATCH_LIFECYCLE = [
  "Order/Production",
  "QC",
  "Pack",
  "Request",
  "Plan",
  "Assign",
  "Load",
  "Approve",
  "Track",
  "Deliver",
  "POD",
  "Invoice",
] as const;

export const REQUEST_STATUSES = [
  "pending",
  "planned",
  "assigned",
  "loading",
  "ready",
  "dispatched",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
] as const;

export const DELIVERY_TYPES = [
  { value: "same_day", label: "Same-day" },
  { value: "scheduled", label: "Scheduled" },
  { value: "express", label: "Express" },
  { value: "priority", label: "Priority" },
  { value: "multi_stop", label: "Multi-stop" },
] as const;

export const SOURCE_TYPES = [
  { value: "sales_order", label: "Sales Order" },
  { value: "production", label: "Production" },
  { value: "transfer", label: "Warehouse Transfer" },
  { value: "return", label: "Return Order" },
  { value: "service", label: "Service Request" },
  { value: "collection", label: "Customer Collection" },
  { value: "inter_branch", label: "Inter-branch Transfer" },
] as const;

export const EXCEPTION_TYPES = [
  { value: "partial", label: "Partial Delivery" },
  { value: "refused", label: "Refused Delivery" },
  { value: "damaged", label: "Damaged Goods" },
  { value: "lost", label: "Lost Shipment" },
  { value: "wrong_address", label: "Wrong Address" },
  { value: "unavailable", label: "Customer Unavailable" },
  { value: "breakdown", label: "Vehicle Breakdown" },
  { value: "delayed", label: "Delayed Delivery" },
] as const;

export const VEHICLE_TYPES = [
  { value: "truck", label: "Truck" },
  { value: "van", label: "Van" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "forklift", label: "Forklift" },
  { value: "car", label: "Company Car" },
  { value: "trailer", label: "Trailer" },
] as const;

export const DOC_TYPES = [
  { value: "dispatch_note", label: "Dispatch Note" },
  { value: "delivery_note", label: "Delivery Note" },
  { value: "packing_list", label: "Packing List" },
  { value: "manifest", label: "Shipping Manifest" },
  { value: "bol", label: "Bill of Lading" },
  { value: "waybill", label: "Waybill" },
  { value: "trip_sheet", label: "Driver Trip Sheet" },
  { value: "customs", label: "Customs Documents" },
] as const;
