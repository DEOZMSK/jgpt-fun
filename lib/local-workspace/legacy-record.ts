/** Read-only compatibility for archived v2 records. No retired calculator runs. */
export const LEGACY_CALCULATION_VERSION = "global-tools-2026-07-17";
export type PeriodMode = "-10" | "+10" | "±5";
type LegacyValue = { valid: true; value: number | string; meaning?: { text: string; href?: string } };
export type LegacyNumerologyResult = {
  calculationType: "vedic-numerology-overview";
  birthDate: string;
  overview: Record<"karma" | "ahamkara" | "dharma" | "expression" | "vyavadhana" | "varna", LegacyValue>;
  periods: { valid: true; rangeLabel: string; rows: Array<{ year: number; marker: string; weekday: string; yearSuffix: string; main: string; background: string }> };
  months: { valid: true; headers: string[]; expressionRow: string[]; karmaRow: string[] };
  generatedForYear: number;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const text = (v: unknown, max = 1000): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);

/** Validate bounded historical JSON, not its retired interpretation or arithmetic. */
export function isLegacyNumerologyResult(v: unknown, date: string, year: number): v is LegacyNumerologyResult {
  if (!record(v) || !keys(v, ["calculationType", "birthDate", "overview", "periods", "months", "generatedForYear"])
    || v.calculationType !== "vedic-numerology-overview" || v.birthDate !== date || v.generatedForYear !== year || !record(v.overview)
    || !keys(v.overview, ["karma", "ahamkara", "dharma", "expression", "vyavadhana", "varna"])) return false;
  for (const value of Object.values(v.overview)) {
    if (!record(value) || !keys(value, ["valid", "value"], ["meaning"]) || value.valid !== true
      || !(typeof value.value === "number" ? Number.isFinite(value.value) && Math.abs(value.value) <= 1000 : text(value.value, 120))) return false;
    if (value.meaning !== undefined && (!record(value.meaning) || !keys(value.meaning, ["text"], ["href"]) || !text(value.meaning.text)
      || (value.meaning.href !== undefined && (!text(value.meaning.href, 500) || !/^\/articles\/[a-z0-9-]+$/.test(value.meaning.href))))) return false;
  }
  const p = v.periods, m = v.months;
  return record(p) && keys(p, ["valid", "rangeLabel", "rows"]) && p.valid === true && text(p.rangeLabel, 100)
    && Array.isArray(p.rows) && p.rows.length <= 31 && p.rows.every(row => record(row) && keys(row, ["year", "marker", "weekday", "yearSuffix", "main", "background"])
      && Number.isInteger(row.year) && Number(row.year) >= 1890 && Number(row.year) <= 2210 && ["marker", "weekday", "yearSuffix", "main", "background"].every(k => text(row[k], 40)))
    && record(m) && keys(m, ["valid", "headers", "expressionRow", "karmaRow"]) && m.valid === true
    && ["headers", "expressionRow", "karmaRow"].every(k => Array.isArray(m[k]) && m[k].length === 12 && m[k].every(s => text(s, 40)));
}
