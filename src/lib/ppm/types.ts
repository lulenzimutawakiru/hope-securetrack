export type PpmProjectStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "delayed"
  | "completed"
  | "cancelled"
  | "closed";

export type PpmTaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | "cancelled";

export type PpmEntityConfig = {
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
