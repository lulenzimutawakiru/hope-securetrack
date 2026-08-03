/**
 * Labels CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const lblAudit = api.audit;
export const lblList = api.list;
export const lblCreate = api.create;
export const lblUpdate = api.update;
export const lblSoftDelete = api.softDelete;
export const lblRestore = api.restore;
export const lblDuplicate = api.duplicate;
export const lblBulkStatus = api.bulkStatus;
export const lblNextNumber = api.nextNumber;
