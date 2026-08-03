export type TaEntityConfig = {
  /** Show the detail drawer (comments + attachments) for records */
  detail?: boolean;
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

export type TaDashboardStats = {
  openVacancies: number;
  applications: number;
  interviewsThisWeek: number;
  offersPending: number;
  hiresThisMonth: number;
  requisitionsPending: number;
  avgMatchScore: number;
  onboardingOpen: number;
};
