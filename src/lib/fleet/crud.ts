/**
 * Fleet CRUD — routed through /api/v2/crud (no browser Supabase writes).
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

export const fleetAudit = api.audit;
export const fleetList = api.list;
export const fleetCreate = api.create;
export const fleetUpdate = api.update;
export const fleetSoftDelete = api.softDelete;
export const fleetRestore = api.restore;
export const fleetDuplicate = api.duplicate;
export const fleetBulkStatus = api.bulkStatus;
export const fleetNextNumber = api.nextNumber;
