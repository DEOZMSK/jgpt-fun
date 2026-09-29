import { normalizeDegrees } from "./jyotish";
import { DASHA_RULES, dashaResult, makePeriod, type DashaConvention } from "./dasha";
import type { DashaPeriod } from "./contracts";

/** Natal Moon mapping from Rao, pp_dasa_transit.pdf p.27; conventions in astrology-methods.md. */
export function yoginiDasha(moon: number, birthUtc: string, convention?: DashaConvention) {
  const DASHA_YEAR_MS = (convention?.yearDays ?? 365.25) * 86_400_000;
  const birth = Date.parse(birthUtc);
  if (!Number.isFinite(birth)) throw new RangeError("Invalid birth instant");
  const rawPosition = normalizeDegrees(moon) * 27 / 360;
  // Remove only binary round-off at an exact nakshatra boundary (a few ULPs).
  // This is not a user-facing rounding tolerance or a reference-chart correction.
  const nearest = Math.round(rawPosition);
  const position = Math.abs(rawPosition - nearest) <= 8 * Number.EPSILON * Math.max(1, rawPosition) ? nearest % 27 : rawPosition;
  const initial = (Math.floor(position) + 3) % 8;
  const rules = DASHA_RULES.yogini;
  let start = birth - (position % 1) * rules.years[initial] * DASHA_YEAR_MS;
  const periods: DashaPeriod[] = [];
  for (let step = 0; start < birth + 120 * DASHA_YEAR_MS; step++) {
    const index = (initial + step) % 8, end = start + rules.years[index] * DASHA_YEAR_MS;
    periods.push(makePeriod("yogini", rules.lords[index], start, end, 0)); start = end;
  }
  return dashaResult("yogini", periods, birthUtc, convention);
}
