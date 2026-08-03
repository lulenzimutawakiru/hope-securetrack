/**
 * PPM CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const ppmAudit = api.audit;
export const ppmList = api.list;
export const ppmCreate = api.create;
export const ppmUpdate = api.update;
export const ppmSoftDelete = api.softDelete;
export const ppmRestore = api.restore;
export const ppmDuplicate = api.duplicate;
export const ppmBulkStatus = api.bulkStatus;
export const ppmNextNumber = api.nextNumber;
