export type LblEntityConfig = {
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

export type LblDashboardStats = {
  templates: number;
  formats: number;
  materials: number;
  lowStock: number;
  openBatches: number;
  labelsReady: number;
  labelsPrinted: number;
  queuedJobs: number;
  failedJobs: number;
  pendingReprints: number;
  shippingReady: number;
  palletReady: number;
};
