/**
 * Currency formatting helper.
 *
 * Single source of truth for how money is displayed across the app — change
 * here once if the business expands beyond Malaysia.
 */

const MYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Format a value as Malaysian Ringgit, e.g. 200 -> "RM 200.00".
 * Accepts numbers, numeric strings (Postgres numeric returns string), or null.
 */
export function formatMYR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  // Intl returns "MYR 200.00"; we prefer the "RM " prefix used locally.
  return MYR.format(n).replace(/^MYR\s?/, "RM ");
}
