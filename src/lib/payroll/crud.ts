/**
 * Payroll CRUD — routed through /api/v2/crud (no browser Supabase writes).
 */
import { createBrowserEntityCrud } from "@/lib/crud/browser-entity-crud";
export {
  toCsv,
  downloadCsv,
  parseCsv,
  validateImportRows,
  type ImportFieldMap,
} from "@/lib/crud/browser-entity-crud";

const api = createBrowserEntityCrud();

export const payAudit = api.audit;
export const payList = api.list;
export const payCreate = api.create;
export const payUpdate = api.update;
export const paySoftDelete = api.softDelete;
export const payRestore = api.restore;
export const payDuplicate = api.duplicate;
export const payBulkStatus = api.bulkStatus;
export const payNextNumber = api.nextNumber;
export const payImportCsv = api.importCsv;
