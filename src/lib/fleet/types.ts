export type FleetVehicleStatus =
  | "available"
  | "assigned"
  | "in_use"
  | "maintenance"
  | "out_of_service"
  | "disposed";

export type FleetDriverStatus =
  | "available"
  | "on_trip"
  | "off_duty"
  | "leave"
  | "suspended"
  | "terminated";

export type FleetTripStatus =
  | "planned"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "delayed"
  | "cancelled"
  | "closed";

export type FleetEntityConfig = {
  title: string;
  description: string;
  table: string;
  numberField?: string;
  numberPrefix?: string;
  searchCols?: string[];
  columns: Array<{ key: string; label: string }>;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "datetime" | "select" | "textarea";
    options?: string[];
    required?: boolean;
    createOnly?: boolean;
    autoNumber?: string;
  }>;
  statusField?: string;
  statusOptions?: string[];
  defaults?: Record<string, unknown>;
};
