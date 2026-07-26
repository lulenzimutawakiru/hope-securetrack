export const APP_NAME = "Hope SecureTrack";
export const COMPANY_NAME = "Hope Design Group Ltd";

export const PRODUCTION_STATUSES = [
  "draft",
  "in_progress",
  "qc_pending",
  "approved",
  "rejected",
  "packed",
  "completed",
  "archived",
] as const;

export const QR_CODE_STATUSES = [
  "generated",
  "printed",
  "verified",
  "packed",
  "dispatched",
  "sold",
  "recalled",
  "voided",
  "counterfeit",
] as const;

export const PRINT_JOB_STATUSES = [
  "pending",
  "queued",
  "printing",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export const ROLE_SLUGS = {
  SUPER_ADMIN: "super_administrator",
  MANAGING_DIRECTOR: "managing_director",
  OPERATIONS_MANAGER: "operations_manager",
  PRODUCTION_MANAGER: "production_manager",
  PRODUCTION_SUPERVISOR: "production_supervisor",
  PRODUCTION_OPERATOR: "production_operator",
  QUALITY_ASSURANCE: "quality_assurance",
  WAREHOUSE_MANAGER: "warehouse_manager",
  WAREHOUSE_CLERK: "warehouse_clerk",
  SALES_MANAGER: "sales_manager",
  SALES_EXECUTIVE: "sales_executive",
  DISTRIBUTOR: "distributor",
  RETAILER: "retailer",
  CUSTOMER_SERVICE: "customer_service",
  AUDITOR: "auditor",
  READ_ONLY: "read_only",
} as const;

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  SETTINGS_MANAGE: "settings.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  PRODUCTION_VIEW: "production.view",
  PRODUCTION_CREATE: "production.create",
  PRODUCTION_EDIT: "production.edit",
  PRODUCTION_MANAGE: "production.manage",
  QUALITY_APPROVE: "quality.approve",
  QR_GENERATE: "qr.generate",
  QR_VIEW: "qr.view",
  PRINTING_CREATE: "printing.create",
  PRINTING_MANAGE: "printing.manage",
  PRINTING_REPRINT: "printing.reprint",
  PACKING_CREATE: "packing.create",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MOVE: "inventory.move",
  INVENTORY_MANAGE: "inventory.manage",
  VERIFICATION_VIEW: "verification.view",
  FRAUD_MANAGE: "fraud.manage",
  FRAUD_INVESTIGATE: "fraud.investigate",
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  AUDIT_VIEW: "audit.view",
  AUDIT_MANAGE: "audit.manage",
  DISTRIBUTORS_VIEW: "distributors.view",
  DISTRIBUTORS_MANAGE: "distributors.manage",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_MANAGE: "products.manage",
} as const;

export const REAMS_PER_CARTON = 5;

export const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: PERMISSIONS.DASHBOARD_VIEW },
  { title: "Production", href: "/dashboard/production", icon: "Factory", permission: PERMISSIONS.PRODUCTION_VIEW },
  { title: "QR Codes", href: "/dashboard/qr-codes", icon: "QrCode", permission: PERMISSIONS.QR_VIEW },
  { title: "Printing", href: "/dashboard/printing", icon: "Printer", permission: PERMISSIONS.PRINTING_CREATE },
  { title: "Packing", href: "/dashboard/packing", icon: "Package", permission: PERMISSIONS.PACKING_CREATE },
  { title: "Inventory", href: "/dashboard/inventory", icon: "Warehouse", permission: PERMISSIONS.INVENTORY_VIEW },
  { title: "Verification", href: "/dashboard/verification", icon: "ShieldCheck", permission: PERMISSIONS.VERIFICATION_VIEW },
  { title: "Fraud Alerts", href: "/dashboard/fraud", icon: "AlertTriangle", permission: PERMISSIONS.FRAUD_MANAGE },
  { title: "Reports", href: "/dashboard/reports", icon: "BarChart3", permission: PERMISSIONS.REPORTS_VIEW },
  { title: "Products", href: "/dashboard/products", icon: "Box", permission: PERMISSIONS.PRODUCTS_VIEW },
  { title: "Distributors", href: "/dashboard/distributors", icon: "Truck", permission: PERMISSIONS.DISTRIBUTORS_VIEW },
  { title: "Users", href: "/dashboard/users", icon: "Users", permission: PERMISSIONS.USERS_VIEW },
  { title: "Audit Logs", href: "/dashboard/audit", icon: "ScrollText", permission: PERMISSIONS.AUDIT_VIEW },
  { title: "Settings", href: "/dashboard/settings", icon: "Settings", permission: PERMISSIONS.SETTINGS_MANAGE },
] as const;
