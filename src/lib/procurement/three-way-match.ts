/**
 * Three-way match: Purchase Order + Goods Receipt + Supplier Invoice.
 * Pure logic is unit-tested; persistence via performThreeWayMatch.
 */

export type MatchStatus = "matched" | "partial" | "exception" | "pending";

export type ThreeWayMatchInput = {
  poAmount: number;
  grnAmount: number;
  invoiceAmount: number;
  /** Absolute currency tolerance (default 1.00) */
  absoluteTolerance?: number;
  /** Relative tolerance as fraction of PO (default 0.5%) */
  relativeTolerance?: number;
  /** Require GRN before full match (default true) */
  requireGrn?: boolean;
};

export type ThreeWayMatchResult = {
  status: MatchStatus;
  variance: number;
  poVariance: number;
  grnVariance: number;
  withinTolerance: boolean;
  toleranceUsed: number;
  notes: string[];
  canPay: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Evaluate PO vs GRN vs Invoice amounts.
 * - matched: all three within tolerance and non-zero
 * - partial: invoice ≤ received within tolerance but under PO (partial delivery)
 * - exception: over-invoice, missing GRN, or variance exceeds tolerance
 */
export function evaluateThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatchResult {
  const po = round2(Number(input.poAmount) || 0);
  const grn = round2(Number(input.grnAmount) || 0);
  const inv = round2(Number(input.invoiceAmount) || 0);
  const absTol = input.absoluteTolerance ?? 1;
  const relTol = input.relativeTolerance ?? 0.005;
  const requireGrn = input.requireGrn !== false;

  const toleranceUsed = round2(Math.max(absTol, Math.abs(po) * relTol));
  const notes: string[] = [];

  if (po <= 0) {
    return {
      status: "exception",
      variance: inv - po,
      poVariance: 0,
      grnVariance: grn - po,
      withinTolerance: false,
      toleranceUsed,
      notes: ["Purchase order amount must be greater than zero"],
      canPay: false,
    };
  }

  if (requireGrn && grn <= 0) {
    return {
      status: "exception",
      variance: inv - po,
      poVariance: inv - po,
      grnVariance: grn - po,
      withinTolerance: false,
      toleranceUsed,
      notes: ["Goods receipt required before matching"],
      canPay: false,
    };
  }

  if (inv <= 0) {
    return {
      status: "pending",
      variance: 0 - po,
      poVariance: -po,
      grnVariance: grn - po,
      withinTolerance: false,
      toleranceUsed,
      notes: ["Supplier invoice amount missing"],
      canPay: false,
    };
  }

  // Invoice must not exceed GRN beyond tolerance (can't pay for unreceived goods)
  const invVsGrn = round2(inv - grn);
  if (invVsGrn > toleranceUsed) {
    notes.push(
      `Invoice exceeds GRN by ${invVsGrn} (tolerance ${toleranceUsed})`
    );
    return {
      status: "exception",
      variance: round2(inv - po),
      poVariance: round2(inv - po),
      grnVariance: round2(grn - po),
      withinTolerance: false,
      toleranceUsed,
      notes,
      canPay: false,
    };
  }

  // Invoice must not exceed PO beyond tolerance
  const invVsPo = round2(inv - po);
  if (invVsPo > toleranceUsed) {
    notes.push(`Invoice exceeds PO by ${invVsPo} (tolerance ${toleranceUsed})`);
    return {
      status: "exception",
      variance: invVsPo,
      poVariance: invVsPo,
      grnVariance: round2(grn - po),
      withinTolerance: false,
      toleranceUsed,
      notes,
      canPay: false,
    };
  }

  // Full match: invoice ≈ PO and GRN ≈ PO (or GRN covers invoice)
  const poClose = Math.abs(invVsPo) <= toleranceUsed;
  const grnCovers = grn + toleranceUsed >= inv;

  if (poClose && grnCovers && Math.abs(grn - po) <= toleranceUsed) {
    notes.push("PO, GRN, and invoice match within tolerance");
    return {
      status: "matched",
      variance: invVsPo,
      poVariance: invVsPo,
      grnVariance: round2(grn - po),
      withinTolerance: true,
      toleranceUsed,
      notes,
      canPay: true,
    };
  }

  // Partial: invoice covered by GRN but less than PO (split deliveries)
  if (grnCovers && inv + toleranceUsed < po) {
    notes.push("Partial match — invoice covered by GRN; PO remaining open");
    return {
      status: "partial",
      variance: invVsPo,
      poVariance: invVsPo,
      grnVariance: round2(grn - po),
      withinTolerance: true,
      toleranceUsed,
      notes,
      canPay: true,
    };
  }

  // GRN and invoice align but under/over PO slightly
  if (grnCovers && Math.abs(invVsPo) <= toleranceUsed) {
    notes.push("Invoice and GRN align with PO within tolerance");
    return {
      status: "matched",
      variance: invVsPo,
      poVariance: invVsPo,
      grnVariance: round2(grn - po),
      withinTolerance: true,
      toleranceUsed,
      notes,
      canPay: true,
    };
  }

  notes.push("Amounts do not reconcile — review exception");
  return {
    status: "exception",
    variance: invVsPo,
    poVariance: invVsPo,
    grnVariance: round2(grn - po),
    withinTolerance: false,
    toleranceUsed,
    notes,
    canPay: false,
  };
}
