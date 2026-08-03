/**
 * TanStack Query key factories for the generic CRUD surface.
 * Centralizing keys keeps cache reads and invalidation consistent across pages.
 */

export const entityKeys = {
  /** All entity queries (broad invalidation). */
  all: ["entity"] as const,
  /** Everything cached for one entity (lists + details). */
  entity: (entity: string) => ["entity", entity] as const,
  /** A specific paginated/filtered list of an entity. */
  list: (entity: string, params?: Record<string, unknown>) =>
    ["entity", entity, "list", params ?? {}] as const,
  /** A single record. */
  detail: (entity: string, id: string) =>
    ["entity", entity, "detail", id] as const,
};
