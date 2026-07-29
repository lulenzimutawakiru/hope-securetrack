/** Enterprise Asset Tagging types */

export const ASSET_LIFECYCLE = [
  "Purchase",
  "Receive",
  "Tag",
  "Assign",
  "Maintain",
  "Transfer",
  "Audit",
  "Retire",
  "Dispose",
] as const;

export const ASSET_DOMAINS = [
  { value: "it", label: "IT Assets" },
  { value: "mfg", label: "Manufacturing" },
  { value: "office", label: "Office" },
  { value: "fleet", label: "Fleet" },
  { value: "digital", label: "Digital" },
  { value: "other", label: "Other" },
] as const;

export const ID_TYPES = [
  { value: "qr", label: "QR Code" },
  { value: "barcode", label: "Barcode" },
  { value: "rfid", label: "RFID" },
  { value: "nfc", label: "NFC" },
  { value: "gps", label: "GPS" },
  { value: "ble", label: "BLE Beacon" },
] as const;

export const ASSET_STATUSES = [
  "draft",
  "active",
  "assigned",
  "maintenance",
  "missing",
  "retired",
  "disposed",
] as const;

export const ASSIGNMENT_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "department", label: "Department" },
  { value: "branch", label: "Branch" },
  { value: "warehouse", label: "Warehouse" },
  { value: "vehicle", label: "Vehicle" },
  { value: "production_line", label: "Production Line" },
  { value: "project", label: "Project" },
] as const;

export const AUDIT_RESULTS = [
  { value: "found", label: "Found" },
  { value: "missing", label: "Missing" },
  { value: "damaged", label: "Damaged" },
  { value: "moved", label: "Moved" },
  { value: "retired", label: "Retired" },
] as const;

export interface TagNumberParts {
  companyPrefix: string;
  domain: string;
  typeCode: string;
  sequence: number;
  padWidth?: number;
  checkDigit?: boolean;
}
