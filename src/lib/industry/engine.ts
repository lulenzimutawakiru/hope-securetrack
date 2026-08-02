/**
 * Industry Configuration Engine for SecureTrack ERP
 * Provides constants and helpers to initialise a tenant for a specific sector.
 */

export interface IndustryTemplate {
  name: string;
  description: string;
  /** Module codes that are enabled by default */
  modules: string[];
  /** Pre‑built workflow templates (key = workflow_type) */
  workflows: Record<string, unknown[]>;
  /** Default custom fields (key = entity_type, value = array of field configs) */
  customFields: Record<string, Array<{
    field_name: string;
    field_label: string;
    field_type: string;
    required: boolean;
    options?: unknown[];
  }>>;
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  manufacturing: {
    name: "Manufacturing",
    description: "Full manufacturing ERP – production, BOM, quality, maintenance, supply chain",
    modules: [
      "production", "bom", "mrp", "quality", "maintenance",
      "warehouse", "procurement", "inventory", "finance", "hr", "crm"
    ],
    workflows: {
      purchase_order: [
        { step: "department_head", label: "Department Head Approval" },
        { step: "finance", label: "Finance Approval" },
        { step: "ceo", label: "CEO Approval (if > $10,000)" }
      ],
      production_order: [
        { step: "production_manager", label: "Production Manager" },
        { step: "qa", label: "Quality Assurance" }
      ]
    },
    customFields: {
      employee: [
        { field_name: "machine_certification", field_label: "Machine Certification", field_type: "text", required: false },
        { field_name: "shift", field_label: "Shift", field_type: "dropdown", required: true, options: ["Day", "Night", "Rotating"] }
      ],
      product: [
        { field_name: "batch_tracking", field_label: "Batch Tracking", field_type: "checkbox", required: false }
      ]
    }
  },

  healthcare: {
    name: "Healthcare",
    description: "Healthcare ERP – patients, appointments, pharmacy, insurance claims",
    modules: [
      "patients", "appointments", "pharmacy", "insurance", "billing",
      "hr", "inventory", "procurement", "finance", "reports"
    ],
    workflows: {
      patient_admission: [
        { step: "doctor", label: "Doctor Approval" },
        { step: "billing", label: "Cost Estimate" },
        { step: "insurance", label: "Insurance Verification" }
      ]
    },
    customFields: {
      patient: [
        { field_name: "blood_group", field_label: "Blood Group", field_type: "dropdown", required: true, options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
        { field_name: "insurance_provider", field_label: "Insurance Provider", field_type: "text", required: false },
        { field_name: "medical_history", field_label: "Medical History", field_type: "textarea", required: false }
      ]
    }
  },

  banking: {
    name: "Banking & Finance",
    description: "Core banking, lending, risk management, compliance",
    modules: [
      "loans", "risk_management", "compliance", "aml_monitoring",
      "finance", "crm", "reports"
    ],
    workflows: {
      loan_request: [
        { step: "credit_review", label: "Credit Review" },
        { step: "risk", label: "Risk Assessment" },
        { step: "approval_committee", label: "Approval Committee" }
      ]
    },
    customFields: {
      customer: [
        { field_name: "kyc_status", field_label: "KYC Status", field_type: "dropdown", required: true, options: ["Pending", "Verified", "Rejected"] },
        { field_name: "risk_score", field_label: "Risk Score", field_type: "number", required: false }
      ]
    }
  },

  education: {
    name: "Education",
    description: "Students, admissions, fees, exams, learning management",
    modules: [
      "students", "admissions", "fees", "exams", "lms", "staff",
      "finance", "procurement", "reports"
    ],
    workflows: {
      admission: [
        { step: "admissions_officer", label: "Admissions Officer" },
        { step: "finance", label: "Finance Verification" },
        { step: "registrar", label: "Registrar Approval" }
      ]
    },
    customFields: {
      student: [
        { field_name: "parent_contact", field_label: "Parent Contact", field_type: "text", required: true },
        { field_name: "scholarship", field_label: "Scholarship", field_type: "checkbox", required: false }
      ]
    }
  },

  // Additional industries can be added as constants
};

/**
 * Returns the IndustryTemplate for a given industry key, or undefined.
 */
export function getIndustryTemplate(key: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES[key];
}

/**
 * List of all supported industry keys.
 */
export function listIndustries(): string[] {
  return Object.keys(INDUSTRY_TEMPLATES);
}
