/**
 * Org chart tree helper unit tests (pure logic, no I/O).
 */
import { describe, it, expect } from "vitest";
import {
  buildOrgTree,
  descendantIds,
  filterTreeByIds,
  findNode,
  flattenTree,
  orgPath,
  orgStats,
  subtreeSizes,
  toOrgCsvRows,
  wouldCreateCycle,
  type OrgNodeLike,
} from "@/lib/enterprise-company/org-tree";

const NODES: OrgNodeLike[] = [
  { id: "ceo", parent_id: null, code: "CEO", name: "Chief Executive", node_type: "company", sort_order: 0 },
  { id: "hr", parent_id: "ceo", code: "HR", name: "Human Resources", node_type: "department", sort_order: 2 },
  { id: "it", parent_id: "ceo", code: "IT", name: "Information Tech", node_type: "department", sort_order: 1 },
  { id: "net", parent_id: "it", code: "NET", name: "Networks", node_type: "cost_center", sort_order: 0 },
  { id: "apps", parent_id: "it", code: "APPS", name: "Applications", node_type: "cost_center", sort_order: 1 },
  { id: "orphan", parent_id: "missing", code: "ORPH", name: "Orphaned", node_type: "branch", sort_order: 0 },
];

describe("buildOrgTree", () => {
  it("sorts siblings by sort_order then name", () => {
    const roots = buildOrgTree(NODES);
    expect(roots).toHaveLength(2); // ceo + orphan fallback root
    expect(roots[0].id).toBe("ceo");
    const kids = roots[0].children.map((c) => c.id);
    expect(kids).toEqual(["it", "hr"]);
    expect(roots[0].children[0].children.map((c) => c.id)).toEqual(["net", "apps"]);
  });

  it("treats orphan parents as roots", () => {
    const roots = buildOrgTree(NODES);
    expect(roots.map((r) => r.id)).toContain("orphan");
  });

  it("handles empty and single-node lists", () => {
    expect(buildOrgTree([])).toEqual([]);
    const single = buildOrgTree([{ id: "a", parent_id: null }]);
    expect(single[0].id).toBe("a");
    expect(single[0].children).toEqual([]);
  });

  it("breaks self-referential cycles by falling back to roots", () => {
    const cyclic = buildOrgTree([{ id: "a", parent_id: "a" }]);
    expect(cyclic[0].id).toBe("a");
  });
});

describe("flattenTree", () => {
  it("emits depth and ancestor-name paths in DFS order", () => {
    const flat = flattenTree(buildOrgTree(NODES));
    const net = flat.find((f) => f.node.id === "net")!;
    expect(net.depth).toBe(2);
    // path lists ancestors only (the node itself is excluded)
    expect(net.path).toEqual(["Chief Executive", "Information Tech"]);
  });
});

describe("findNode", () => {
  it("returns the matching node or null", () => {
    expect(findNode(NODES, "it")?.name).toBe("Information Tech");
    expect(findNode(NODES, "nope")).toBeNull();
    expect(findNode(NODES, null)).toBeNull();
  });
});

describe("descendantIds", () => {
  it("collects all descendants but not the root", () => {
    const ids = descendantIds(NODES, "ceo");
    expect([...ids].sort()).toEqual(["apps", "hr", "it", "net"]);
  });
});

describe("wouldCreateCycle", () => {
  it("rejects self-parenting", () => {
    expect(wouldCreateCycle(NODES, "it", "it")).toBe(true);
  });
  it("rejects parenting under a descendant", () => {
    expect(wouldCreateCycle(NODES, "ceo", "net")).toBe(true);
  });
  it("allows valid reparents and root moves", () => {
    expect(wouldCreateCycle(NODES, "net", "hr")).toBe(false);
    expect(wouldCreateCycle(NODES, "it", null)).toBe(false);
  });
});

describe("subtreeSizes", () => {
  it("counts node plus descendants", () => {
    const sizes = subtreeSizes(NODES);
    expect(sizes.get("ceo")).toBe(5);
    expect(sizes.get("it")).toBe(3);
    expect(sizes.get("net")).toBe(1);
  });
});

describe("orgPath", () => {
  it("builds root-to-node breadcrumbs", () => {
    expect(orgPath(NODES, "apps")).toEqual(["Chief Executive", "Information Tech", "Applications"]);
    expect(orgPath(NODES, "ceo")).toEqual(["Chief Executive"]);
  });
  it("falls back to id for unknown parents", () => {
    expect(orgPath(NODES, "orphan")).toEqual(["Orphaned"]);
  });
});

describe("orgStats", () => {
  const statsNodes: OrgNodeLike[] = [
    { id: "a", node_type: "company", is_active: true },
    { id: "b", node_type: "department", is_active: true, parent_id: "a" },
    { id: "c", node_type: "department", is_active: false, parent_id: "a" },
    { id: "d", node_type: "cost_center", deleted_at: "2026-01-01T00:00:00Z", parent_id: "b" },
  ];
  it("reports totals, active, archived, depth and type counts", () => {
    const s = orgStats(statsNodes);
    expect(s.total).toBe(4);
    expect(s.active).toBe(2);
    expect(s.archived).toBe(2);
    expect(s.maxDepth).toBe(3);
    expect(s.byType).toEqual({ company: 1, department: 2, cost_center: 1 });
  });
});

describe("filterTreeByIds", () => {
  it("keeps matched ids and their ancestors only", () => {
    const roots = buildOrgTree(NODES);
    const filtered = filterTreeByIds(roots, new Set(["net"]));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("ceo");
    expect(filtered[0].children.map((c) => c.id)).toEqual(["it"]);
    expect(filtered[0].children[0].children.map((c) => c.id)).toEqual(["net"]);
  });
});

describe("toOrgCsvRows", () => {
  it("maps parents to codes and normalizes flags", () => {
    const rows = toOrgCsvRows(NODES);
    const it = rows.find((r) => r.code === "IT")!;
    expect(it.parent_code).toBe("CEO");
    expect(it.sort_order).toBe(1);
    const root = rows.find((r) => r.code === "CEO")!;
    expect(root.parent_code).toBe("");
    const orphan = rows.find((r) => r.code === "ORPH")!;
    expect(orphan.parent_code).toBe("");
  });
});