/** Enterprise Invoicing & Billing — shared types */

export type InvoiceType =
  | "standard"
  | "tax"
  | "proforma"
  | "recurring"
  | "credit_note"
  | "debit_note"
  | "export"
  | "commercial";

export type InvoiceSource =
  | "manual"
  | "sales_order"
  | "delivery"
  | "contract"
  | "subscription"
  | "timesheet"
  | "project"
  | "service"
  | "ai";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "credit_card"
  | "card"
  | "mobile_money"
  | "mtn_momo"
  | "airtel_money"
  | "cheque"
  | "pos"
  | "wallet"
  | "paypal"
  | "stripe"
  | "flutterwave"
  | "pesapal"
  | "other";

export interface BillLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  tax_rate?: number;
  tax_code?: string;
  discount_pct?: number;
  product_id?: string | null;
  line_type?: string;
}

export interface TaxBreakdownRow {
  tax_code: string;
  name: string;
  rate: number;
  taxable: number;
  tax: number;
}

export interface ComputedTotals {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  withholding_tax: number;
  shipping_amount: number;
  total_amount: number;
  balance_due: number;
  tax_breakdown: TaxBreakdownRow[];
  lines: Array<
    BillLineInput & {
      line_subtotal: number;
      discount_amount: number;
      tax_amount: number;
      line_total: number;
    }
  >;
}

export const INVOICE_TYPES: { value: InvoiceType; label: string; desc: string }[] = [
  { value: "standard", label: "Standard Invoice", desc: "Normal customer billing" },
  { value: "tax", label: "Tax Invoice", desc: "VAT-compliant with tax breakdown" },
  { value: "proforma", label: "Proforma", desc: "Pre-billing / quotation billing" },
  { value: "recurring", label: "Recurring", desc: "Subscription / maintenance" },
  { value: "credit_note", label: "Credit Note", desc: "Returns, adjustments, discounts" },
  { value: "debit_note", label: "Debit Note", desc: "Additional charges / corrections" },
  { value: "export", label: "Export Invoice", desc: "International customers" },
  { value: "commercial", label: "Commercial Invoice", desc: "Shipping & customs" },
];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "pos", label: "POS" },
  { value: "wallet", label: "Wallet" },
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "flutterwave", label: "Flutterwave" },
  { value: "pesapal", label: "Pesapal" },
  { value: "other", label: "Other" },
];

export const REVENUE_LIFECYCLE = [
  "Customer",
  "Quotation",
  "Sales Order",
  "Delivery",
  "Invoice Generation",
  "Approval",
  "Invoice Delivery",
  "Payment Collection",
  "Reconciliation",
  "Revenue Reporting",
] as const;

export const ENTITY_TYPES = [
  "company",
  "government",
  "institution",
  "retail",
  "distributor",
  "dealer",
  "department",
  "supplier",
] as const;
