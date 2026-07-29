import type { BomExplosionNode, BomLineInput } from "./types";

/** Apply scrap %: required = base * (1 + scrap/100) / (yield/100) */
export function requiredQty(
  baseQty: number,
  scrapPct = 0,
  yieldPct = 100
): number {
  const y = yieldPct > 0 ? yieldPct / 100 : 1;
  const s = 1 + Math.max(0, scrapPct) / 100;
  return round4((baseQty * s) / y);
}

/** Single-level cost rollup from component lines */
export function rollupBomCost(
  lines: Array<{ quantity: number; unit_cost?: number; scrap_pct?: number }>,
  yieldPct = 100
): number {
  const raw = lines.reduce((sum, l) => {
    const q = requiredQty(Number(l.quantity) || 0, Number(l.scrap_pct) || 0, 100);
    return sum + q * (Number(l.unit_cost) || 0);
  }, 0);
  const y = yieldPct > 0 ? yieldPct / 100 : 1;
  return round4(raw / y);
}

/**
 * Explode multi-level BOM.
 * bomMap: parent product_id or parent code → component lines
 */
export function explodeBom(
  rootCode: string,
  rootName: string,
  orderQty: number,
  bomMap: Map<string, BomLineInput[]>,
  maxDepth = 8
): BomExplosionNode {
  function walk(
    code: string,
    name: string,
    qty: number,
    level: number,
    productId?: string | null
  ): BomExplosionNode {
    const lines = bomMap.get(code) || [];
    const children: BomExplosionNode[] = [];
    let unitCost = 0;

    if (level < maxDepth) {
      for (const line of lines) {
        if (line.is_alternative) continue;
        const childQty = requiredQty(qty * (Number(line.quantity) || 0), line.scrap_pct || 0);
        const child = walk(
          line.component_code,
          line.component_name,
          childQty,
          level + 1,
          line.component_product_id
        );
        children.push(child);
      }
    }

    if (children.length === 0) {
      const leaf = lines[0];
      unitCost = Number(leaf?.unit_cost) || 0;
    } else {
      unitCost =
        qty > 0
          ? children.reduce((s, c) => s + c.extended_cost, 0) / qty
          : 0;
    }

    // If leaf with explicit unit_cost on map entry
    if (children.length === 0 && lines.length === 0) {
      unitCost = 0;
    }

    return {
      product_id: productId ?? null,
      code,
      name,
      qty: round4(qty),
      uom: "EA",
      level,
      unit_cost: round4(unitCost),
      extended_cost: round4(unitCost * qty),
      children,
    };
  }

  return walk(rootCode, rootName, orderQty, 0);
}

/** Flatten explosion for MRP / material issues */
export function flattenExplosion(node: BomExplosionNode): Array<{
  code: string;
  name: string;
  qty: number;
  level: number;
  unit_cost: number;
  product_id?: string | null;
}> {
  const out: Array<{
    code: string;
    name: string;
    qty: number;
    level: number;
    unit_cost: number;
    product_id?: string | null;
  }> = [];

  function visit(n: BomExplosionNode) {
    if (n.level > 0) {
      out.push({
        code: n.code,
        name: n.name,
        qty: n.qty,
        level: n.level,
        unit_cost: n.unit_cost,
        product_id: n.product_id,
      });
    }
    n.children.forEach(visit);
  }
  visit(node);
  return out;
}

/** Compare two BOM line sets — added / removed / qty changed */
export function compareBom(
  a: BomLineInput[],
  b: BomLineInput[]
): {
  added: BomLineInput[];
  removed: BomLineInput[];
  changed: Array<{ code: string; from: number; to: number }>;
} {
  const mapA = new Map(a.map((l) => [l.component_code, l]));
  const mapB = new Map(b.map((l) => [l.component_code, l]));
  const added: BomLineInput[] = [];
  const removed: BomLineInput[] = [];
  const changed: Array<{ code: string; from: number; to: number }> = [];

  for (const [code, line] of mapB) {
    if (!mapA.has(code)) added.push(line);
    else {
      const prev = mapA.get(code)!;
      if (Number(prev.quantity) !== Number(line.quantity)) {
        changed.push({ code, from: Number(prev.quantity), to: Number(line.quantity) });
      }
    }
  }
  for (const [code, line] of mapA) {
    if (!mapB.has(code)) removed.push(line);
  }
  return { added, removed, changed };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
