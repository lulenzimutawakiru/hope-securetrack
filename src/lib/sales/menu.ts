/** Complete Advanced Sales navigation */

export const SALES_MENU = [
  { title: "Sales Dashboard", href: "/dashboard/sales", group: "Overview" },
  { title: "Live Pipeline Board", href: "/dashboard/sales/live", group: "Overview" },
  { title: "Quote-to-Cash", href: "/dashboard/sales/quote-to-cash", group: "Overview" },

  { title: "Leads", href: "/dashboard/sales/leads", group: "Pipeline" },
  { title: "Opportunities", href: "/dashboard/sales/opportunities", group: "Pipeline" },
  { title: "Pipeline Kanban", href: "/dashboard/sales/pipeline", group: "Pipeline" },
  { title: "Activities", href: "/dashboard/sales/activities", group: "Pipeline" },
  { title: "Call Logs", href: "/dashboard/sales/call-logs", group: "Pipeline" },
  { title: "Competitors", href: "/dashboard/sales/competitors", group: "Pipeline" },

  { title: "Quotations", href: "/dashboard/sales/quotations", group: "Quoting" },
  { title: "Quote Lines", href: "/dashboard/sales/quote-lines", group: "Quoting" },
  { title: "Price Lists", href: "/dashboard/sales/price-lists", group: "Quoting" },
  { title: "Price Items", href: "/dashboard/sales/price-items", group: "Quoting" },
  { title: "Discount Rules", href: "/dashboard/sales/discount-rules", group: "Quoting" },
  { title: "Promotions", href: "/dashboard/sales/promotions", group: "Quoting" },

  { title: "Sales Orders", href: "/dashboard/sales/orders", group: "Orders" },
  { title: "Order Lines", href: "/dashboard/sales/order-lines", group: "Orders" },
  { title: "Order Approvals", href: "/dashboard/sales/approvals", group: "Orders" },
  { title: "Blanket Orders", href: "/dashboard/sales/blanket-orders", group: "Orders" },

  { title: "Credit Reviews", href: "/dashboard/sales/credit", group: "Credit" },
  { title: "Credit Holds", href: "/dashboard/sales/credit-holds", group: "Credit" },
  { title: "Payment Terms", href: "/dashboard/sales/payment-terms", group: "Credit" },

  { title: "Contracts", href: "/dashboard/sales/contracts", group: "Contracts" },
  { title: "Contract Lines", href: "/dashboard/sales/contract-lines", group: "Contracts" },
  { title: "Rebates", href: "/dashboard/sales/rebates", group: "Contracts" },

  { title: "Territories", href: "/dashboard/sales/territories", group: "Territory" },
  { title: "Sales Teams", href: "/dashboard/sales/teams", group: "Territory" },
  { title: "Channels", href: "/dashboard/sales/channels", group: "Territory" },

  { title: "Visit Plans", href: "/dashboard/sales/visit-plans", group: "Field" },
  { title: "Samples", href: "/dashboard/sales/samples", group: "Field" },
  { title: "Field Map", href: "/dashboard/sales/field-map", group: "Field" },

  { title: "Forecasts", href: "/dashboard/sales/forecasts", group: "Revenue" },
  { title: "Targets", href: "/dashboard/sales/targets", group: "Revenue" },
  { title: "Commissions", href: "/dashboard/sales/commissions", group: "Revenue" },
  { title: "Commission Accrual", href: "/dashboard/sales/commission-accrual", group: "Revenue" },

  { title: "Returns / RMA", href: "/dashboard/sales/returns", group: "After-Sales" },
  { title: "Return Lines", href: "/dashboard/sales/return-lines", group: "After-Sales" },
  { title: "Support Tickets", href: "/dashboard/sales/support", group: "After-Sales" },

  { title: "Documents", href: "/dashboard/sales/documents", group: "Documents" },
  { title: "Proposals", href: "/dashboard/sales/proposals", group: "Documents" },

  { title: "Sales Reports", href: "/dashboard/sales/reports", group: "Analytics" },
  { title: "Analytics", href: "/dashboard/sales/analytics", group: "Analytics" },
  { title: "AI Sales Assistant", href: "/dashboard/sales/ai", group: "Analytics" },
  { title: "Insights", href: "/dashboard/sales/insights", group: "Analytics" },

  { title: "Invoices", href: "/dashboard/invoices", group: "Integrations" },
  { title: "CRM", href: "/dashboard/crm", group: "Integrations" },
  { title: "Dispatch", href: "/dashboard/dispatch", group: "Integrations" },
  { title: "Billing", href: "/dashboard/billing", group: "Integrations" },

  { title: "Notifications", href: "/dashboard/sales/notifications", group: "System" },
  { title: "Audit Logs", href: "/dashboard/sales/audit", group: "System" },
  { title: "Sales Settings", href: "/dashboard/sales/settings", group: "System" },
] as const;
