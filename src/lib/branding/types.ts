/** Enterprise Branding & DAM types */

export const LOGO_TYPES = [
  { value: "primary", label: "Primary Logo" },
  { value: "secondary", label: "Secondary Logo" },
  { value: "icon", label: "Icon Logo" },
  { value: "monogram", label: "Monogram" },
  { value: "watermark", label: "Watermark" },
  { value: "dark", label: "Dark Logo" },
  { value: "light", label: "Light Logo" },
] as const;

export const COLOR_ROLES = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
  { value: "neutral", label: "Neutral" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "custom", label: "Custom" },
] as const;

export const ASSET_TYPES = [
  { value: "image", label: "Image" },
  { value: "logo", label: "Logo" },
  { value: "product", label: "Product Image" },
  { value: "marketing", label: "Marketing" },
  { value: "photo", label: "Photo" },
  { value: "document", label: "Document" },
  { value: "design", label: "Design File" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
] as const;

export const TEMPLATE_CATEGORIES = [
  { value: "finance", label: "Finance" },
  { value: "procurement", label: "Procurement" },
  { value: "hr", label: "HR" },
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
  { value: "marketing", label: "Marketing" },
  { value: "security", label: "Security Printing" },
  { value: "email", label: "Email" },
  { value: "ui", label: "UI / Theme" },
] as const;

export const CANVAS_SIZES = [
  { value: "A4", label: "A4" },
  { value: "Letter", label: "Letter" },
  { value: "ID", label: "ID Card" },
  { value: "BusinessCard", label: "Business Card" },
  { value: "Label", label: "Label" },
  { value: "Poster", label: "Poster" },
  { value: "Social", label: "Social Media" },
] as const;

export const APPROVAL_STAGES = [
  { value: "marketing_review", label: "Marketing Review" },
  { value: "brand_review", label: "Brand Manager Approval" },
  { value: "management_review", label: "Management Approval" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
] as const;

export const BRAND_LIFECYCLE = [
  "Identity",
  "Colors & Type",
  "Guidelines",
  "Assets",
  "Templates",
  "Documents",
  "Products",
  "Approval",
  "Publish",
  "Compliance",
] as const;

export interface BrandColorInput {
  name: string;
  hex_value: string;
  color_role?: string;
  usage_rules?: string;
}
