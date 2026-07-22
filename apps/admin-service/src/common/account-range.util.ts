/**
 * Parses account-range expressions used by DimensionAccountRule.sourceRange:
 *   "12100"                 -> single account
 *   "11100..11999"          -> inclusive range (".." delimiter)
 *   "11100..11999,12100"    -> multiple ranges/single codes ("," delimiter)
 */

export interface AccountRangeSegment {
  start: string;
  end: string;
}

export function parseAccountRange(expr: string): AccountRangeSegment[] {
  return expr
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const parts = segment.split('..').map((p) => p.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { start: parts[0], end: parts[1] };
      }
      return { start: parts[0], end: parts[0] };
    });
}

/** Numeric comparison when both codes are numeric (the common case for this COA); lexicographic otherwise. */
function compareCodes(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function accountMatchesRange(accountCode: string, expr: string): boolean {
  return parseAccountRange(expr).some(
    ({ start, end }) => compareCodes(accountCode, start) >= 0 && compareCodes(accountCode, end) <= 0,
  );
}

/** True if every segment is well-formed (non-empty start/end, start <= end for ranges). */
export function isValidAccountRangeExpr(expr: string): boolean {
  const segments = expr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) return false;

  return segments.every((segment) => {
    const parts = segment.split('..').map((p) => p.trim());
    if (parts.length === 1) return parts[0].length > 0;
    if (parts.length === 2) return parts[0].length > 0 && parts[1].length > 0 && compareCodes(parts[0], parts[1]) <= 0;
    return false;
  });
}

/**
 * How many account codes a range expression covers — smaller means more specific.
 * Used to pick the winning rule when multiple rules match the same account.
 */
export function rangeSpecificity(expr: string): number {
  return parseAccountRange(expr).reduce((total, { start, end }) => {
    const ns = Number(start);
    const ne = Number(end);
    if (!Number.isNaN(ns) && !Number.isNaN(ne)) {
      return total + (ne - ns + 1);
    }
    return total + (start === end ? 1 : Number.MAX_SAFE_INTEGER);
  }, 0);
}

/**
 * Combined specificity across a rule's ANDed conditions (one per source dimension) — the product of
 * each condition's own specificity, since matching N independent axes narrows the match set
 * multiplicatively. Smaller means more specific; clamped so multiplying several large ranges can't
 * overflow into a value that breaks numeric comparison.
 */
export function combinedSpecificity(rangeExprs: string[]): number {
  return rangeExprs.reduce((acc, expr) => {
    const product = acc * rangeSpecificity(expr);
    return Number.isFinite(product) ? Math.min(product, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  }, 1);
}
