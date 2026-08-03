/**
 * Pure org-chart tree helpers — deterministic, unit-testable, no I/O.
 */

export interface OrgNodeLike {
  id: string;
  parent_id?: string | null;
  code?: string;
  name?: string;
  node_type?: string;
  manager_name?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
}

export type OrgTreeNode<T extends OrgNodeLike = OrgNodeLike> = T & {
  children: OrgTreeNode<T>[];
};

export interface FlattenedNode<T extends OrgNodeLike = OrgNodeLike> {
  node: OrgTreeNode<T>;
  depth: number;
  path: string[];
}

/** Build a stable tree from a flat node list. Cycles/orphans fall back to roots. */
export function buildOrgTree<T extends OrgNodeLike>(nodes: T[]): OrgTreeNode<T>[] {
  const map = new Map<string, OrgTreeNode<T>>();
  const roots: OrgTreeNode<T>[] = [];
  for (const n of nodes) map.set(n.id, { ...n, children: [] });

  // True when walking up from startId reaches targetId (cycle / self-parenting).
  const reaches = (startId: string, targetId: string): boolean => {
    let cur: string | undefined = startId;
    let guard = 0;
    while (cur && guard++ <= nodes.length) {
      if (cur === targetId) return true;
      cur = map.get(cur)?.parent_id ?? undefined;
    }
    return false;
  };

  for (const n of nodes) {
    const node = map.get(n.id)!;
    const parentId = n.parent_id ?? null;
    const parent = parentId ? map.get(parentId) : undefined;
    if (parentId && parent && !reaches(parentId, n.id)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortLevel = (arr: OrgTreeNode<T>[]) => {
    arr.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
    for (const n of arr) sortLevel(n.children);
  };
  sortLevel(roots);
  return roots;
}

/** Depth-first flattened view with per-level depth and ancestor-name path. */
export function flattenTree<T extends OrgNodeLike>(
  roots: OrgTreeNode<T>[]
): FlattenedNode<T>[] {
  const out: FlattenedNode<T>[] = [];
  const walk = (nodes: OrgTreeNode<T>[], depth: number, path: string[]) => {
    for (const n of nodes) {
      out.push({ node: n, depth, path });
      walk(n.children, depth + 1, [...path, String(n.name ?? "")]);
    }
  };
  walk(roots, 0, []);
  return out;
}

export function findNode<T extends OrgNodeLike>(
  nodes: T[],
  id: string | null | undefined
): T | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) ?? null;
}

/** All descendant ids of rootId (excluding rootId itself). */
export function descendantIds<T extends OrgNodeLike>(
  nodes: T[],
  rootId: string
): Set<string> {
  const ids = new Set<string>();
  const walk = (parentId: string | null) => {
    for (const n of nodes) {
      if ((n.parent_id ?? null) === parentId) {
        ids.add(n.id);
        walk(n.id);
      }
    }
  };
  walk(rootId);
  ids.delete(rootId);
  return ids;
}

/** Subtree size per node (node itself + descendants). */
export function subtreeSizes<T extends OrgNodeLike>(
  nodes: T[]
): Map<string, number> {
  const childrenOf = new Map<string | null, T[]>();
  for (const n of nodes) {
    const pid = n.parent_id ?? null;
    const list = childrenOf.get(pid) ?? [];
    list.push(n);
    childrenOf.set(pid, list);
  }
  const sizes = new Map<string, number>();
  const sizeOf = (id: string | null): number => {
    let total = id ? 1 : 0;
    for (const c of childrenOf.get(id) ?? []) total += sizeOf(c.id);
    if (id) sizes.set(id, total);
    return total;
  };
  sizeOf(null);
  return sizes;
}

/** True when moving nodeId under newParentId would create a cycle (self/descendant parent). */
export function wouldCreateCycle<T extends OrgNodeLike>(
  nodes: T[],
  nodeId: string,
  newParentId: string | null | undefined
): boolean {
  if (!newParentId) return false;
  if (newParentId === nodeId) return true;
  return descendantIds(nodes, nodeId).has(newParentId);
}

/** Root-to-node name breadcrumb. */
export function orgPath<T extends OrgNodeLike>(nodes: T[], id: string): string[] {
  const path: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur: T | undefined = byId.get(id);
  let guard = 0;
  while (cur && guard++ < nodes.length + 1) {
    path.unshift(String(cur.name ?? cur.id));
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

export interface OrgStats {
  total: number;
  active: number;
  archived: number;
  maxDepth: number;
  byType: Record<string, number>;
}

export function orgStats<T extends OrgNodeLike>(nodes: T[]): OrgStats {
  const byType: Record<string, number> = {};
  let active = 0;
  let archived = 0;
  for (const n of nodes) {
    const t = n.node_type ?? "node";
    byType[t] = (byType[t] ?? 0) + 1;
    if (n.deleted_at || n.is_active === false) archived++;
    else active++;
  }
  const roots = buildOrgTree(nodes);
  let maxDepth = 0;
  for (const f of flattenTree(roots)) maxDepth = Math.max(maxDepth, f.depth);
  return { total: nodes.length, active, archived, maxDepth: maxDepth + 1, byType };
}

export const ORG_CSV_COLUMNS = [
  "code",
  "name",
  "node_type",
  "parent_code",
  "manager_name",
  "sort_order",
  "is_active",
] as const;

/** Flat CSV rows with parent referenced by code (import/export friendly). */
export function toOrgCsvRows<T extends OrgNodeLike>(nodes: T[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => {
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    return {
      code: n.code ?? "",
      name: n.name ?? "",
      node_type: n.node_type ?? "",
      parent_code: parent?.code ?? "",
      manager_name: n.manager_name ?? "",
      sort_order: n.sort_order ?? 0,
      is_active: n.is_active === false ? "false" : "true",
    };
  });
}

/** Prune a tree to keep matched ids plus all their ancestors (search support). */
export function filterTreeByIds<T extends OrgNodeLike>(
  roots: OrgTreeNode<T>[],
  keep: Set<string>
): OrgTreeNode<T>[] {
  const prune = (nodes: OrgTreeNode<T>[]): OrgTreeNode<T>[] => {
    const out: OrgTreeNode<T>[] = [];
    for (const n of nodes) {
      const children = prune(n.children);
      if (keep.has(n.id) || children.length > 0) {
        out.push({ ...n, children });
      }
    }
    return out;
  };
  return prune(roots);
}
