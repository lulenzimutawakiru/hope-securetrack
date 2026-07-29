export type SalesEntityConfig = {
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

export type SalesDashboardStats = {
  customers: number;
  openLeads: number;
  openOpps: number;
  pipelineValue: number;
  weightedPipeline: number;
  openQuotes: number;
  quoteValue: number;
  openOrders: number;
  orderValue: number;
  returnsOpen: number;
  creditHolds: number;
  commissionsDue: number;
  contractsActive: number;
  forecastMonth: number;
  targetAchievement: number;
};
