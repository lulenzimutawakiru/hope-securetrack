/**
 * Attendance CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const attAudit = api.audit;
export const attList = api.list;
export const attCreate = api.create;
export const attUpdate = api.update;
export const attSoftDelete = api.softDelete;
export const attRestore = api.restore;
export const attDuplicate = api.duplicate;
export const attBulkStatus = api.bulkStatus;
export const attNextNumber = api.nextNumber;
