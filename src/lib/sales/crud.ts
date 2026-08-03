/**
 * Sales CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const salesAudit = api.audit;
export const salesList = api.list;
export const salesCreate = api.create;
export const salesUpdate = api.update;
export const salesSoftDelete = api.softDelete;
export const salesRestore = api.restore;
export const salesDuplicate = api.duplicate;
export const salesBulkStatus = api.bulkStatus;
export const salesNextNumber = api.nextNumber;
