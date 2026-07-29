/** Complete Advanced Labels navigation */

export const LBL_MENU = [
  { title: "Labels Dashboard", href: "/dashboard/labels", group: "Overview" },
  { title: "Auth QR Sheet", href: "/dashboard/labels/auth-sheet", group: "Overview" },
  { title: "Live Print Queue", href: "/dashboard/labels/jobs", group: "Overview" },

  { title: "Templates", href: "/dashboard/labels/templates", group: "Design" },
  { title: "Formats & Sizes", href: "/dashboard/labels/formats", group: "Design" },
  { title: "Field Layout", href: "/dashboard/labels/fields", group: "Design" },
  { title: "Variables", href: "/dashboard/labels/variables", group: "Design" },
  { title: "Categories", href: "/dashboard/labels/categories", group: "Design" },
  { title: "Designer", href: "/dashboard/print/designer", group: "Design" },

  { title: "Barcode Library", href: "/dashboard/labels/barcodes", group: "Codes" },
  { title: "GS1 Configuration", href: "/dashboard/labels/gs1", group: "Codes" },
  { title: "Security Features", href: "/dashboard/labels/security", group: "Codes" },
  { title: "QR & Codes Hub", href: "/dashboard/print/codes", group: "Codes" },

  { title: "Label Batches", href: "/dashboard/labels/batches", group: "Production" },
  { title: "Label Instances", href: "/dashboard/labels/instances", group: "Production" },
  { title: "Print Jobs", href: "/dashboard/labels/jobs", group: "Production" },
  { title: "Automation Rules", href: "/dashboard/labels/rules", group: "Production" },
  { title: "Reprints", href: "/dashboard/labels/reprints", group: "Production" },
  { title: "Approvals", href: "/dashboard/labels/approvals", group: "Production" },

  { title: "Product Labels", href: "/dashboard/labels/product", group: "Types" },
  { title: "Carton Labels", href: "/dashboard/labels/carton", group: "Types" },
  { title: "Pallet Labels", href: "/dashboard/labels/pallet", group: "Types" },
  { title: "Shipping Labels", href: "/dashboard/labels/shipping", group: "Types" },
  { title: "Shelf / Bin Labels", href: "/dashboard/labels/shelf", group: "Types" },
  { title: "Compliance Labels", href: "/dashboard/labels/compliance", group: "Types" },

  { title: "Materials", href: "/dashboard/labels/materials", group: "Stock" },
  { title: "Media Stock", href: "/dashboard/labels/stock", group: "Stock" },
  { title: "Printer Profiles", href: "/dashboard/labels/printer-profiles", group: "Stock" },
  { title: "Niimbot Hub", href: "/dashboard/print/niimbot", group: "Stock" },

  { title: "Documents", href: "/dashboard/labels/documents", group: "Documents" },

  { title: "Reports", href: "/dashboard/labels/reports", group: "Analytics" },
  { title: "Analytics", href: "/dashboard/labels/analytics", group: "Analytics" },
  { title: "AI Labels Assistant", href: "/dashboard/labels/ai", group: "Analytics" },
  { title: "Insights", href: "/dashboard/labels/insights", group: "Analytics" },

  { title: "Print Ops", href: "/dashboard/print", group: "Integrations" },
  { title: "QR Codes", href: "/dashboard/qr-codes", group: "Integrations" },
  { title: "Packaging", href: "/dashboard/packaging", group: "Integrations" },
  { title: "Production", href: "/dashboard/production", group: "Integrations" },

  { title: "Notifications", href: "/dashboard/labels/notifications", group: "System" },
  { title: "Audit Logs", href: "/dashboard/labels/audit", group: "System" },
  { title: "Label Settings", href: "/dashboard/labels/settings", group: "System" },
] as const;
