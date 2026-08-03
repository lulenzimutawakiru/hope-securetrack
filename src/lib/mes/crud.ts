/**
 * MES CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const mesAudit = api.audit;
export const mesList = api.list;
export const mesCreate = api.create;
export const mesUpdate = api.update;
export const mesSoftDelete = api.softDelete;
export const mesRestore = api.restore;
export const mesDuplicate = api.duplicate;
export const mesBulkStatus = api.bulkStatus;
export const mesNextNumber = api.nextNumber;
