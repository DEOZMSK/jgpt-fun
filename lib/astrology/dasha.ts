import type { AstrologyCalculation, DashaPeriod, DashaResult, DashaSystem } from "./contracts";

export const DASHA_YEAR_MS = 365.25 * 86_400_000;
export const DASHA_RULES = {
  vimshottari: { method: "vimshottari-moon-365.25-v1", lords: ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"], years: [7, 20, 6, 10, 7, 18, 16, 19, 17], cycleYears: 120 },
  yogini: { method: "yogini-moon-parent-first-365.25-v1", lords: ["Moon", "Sun", "Jupiter", "Mars", "Mercury", "Saturn", "Venus", "Rahu"], years: [1, 2, 3, 4, 5, 6, 7, 8], cycleYears: 36 }
} as const;
export const DASHA_LEVELS = ["Mahadasha", "Antardasha", "Pratyantardasha", "Sukshmadasha"] as const;
export function dashaRef(p: DashaPeriod, system: DashaSystem = p.system ?? "vimshottari") { return `dasha/${system}/${p.level}/${p.lord}/${p.start}`; }
export function makePeriod(system: DashaSystem, lord: string, start: number, end: number, level: number): DashaPeriod {
  const p = { system, lord, start: new Date(Math.round(start)).toISOString(), end: new Date(Math.round(end)).toISOString(), level };
  return { ...p, ref: dashaRef(p) };
}
/** Half-open intervals. Rounding cumulative boundaries preserves every millisecond. */
export function dashaChildren(parent: DashaPeriod, system: DashaSystem = parent.system ?? "vimshottari"): DashaPeriod[] {
  if (!Number.isInteger(parent.level) || parent.level < 0 || parent.level >= 3 || (parent.system && parent.system !== system)) return [];
  const rules = DASHA_RULES[system];
  const index = rules.lords.findIndex(lord => lord === parent.lord);
  const start = Date.parse(parent.start), end = Date.parse(parent.end);
  if (index < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  let weight = 0;
  return rules.lords.map((_, step) => {
    const i = (index + step) % rules.lords.length;
    const from = start + Math.round((end - start) * weight / rules.cycleYears);
    weight += rules.years[i];
    return makePeriod(system, rules.lords[i], from, start + Math.round((end - start) * weight / rules.cycleYears), parent.level + 1);
  });
}
export type DashaConvention = Pick<DashaResult, "yearDays" | "basisRef" | "method">;
export const SPLIT_DASHA_CONVENTIONS: Record<DashaSystem, DashaConvention> = {
  vimshottari: { yearDays: 365.24219, basisRef: "dasha-basis/Moon", method: "vimshottari-pushya-moon-365.24219-v3" },
  yogini: { yearDays: 365.25, basisRef: "dasha-basis/Moon", method: "yogini-pushya-parent-first-365.25-v3" }
};
export const GEOMETRIC_DASHA_CONVENTIONS: Record<DashaSystem, DashaConvention> = {
  vimshottari: { yearDays: 365.24219, basisRef: "dasha-basis/Moon", method: "vimshottari-pushya-geometric-civil-ut-365.24219-v6" },
  yogini: { yearDays: 365.25, basisRef: "dasha-basis/Moon", method: "yogini-pushya-geometric-civil-ut-parent-first-365.25-v6" }
};
export function dashaResult(system: DashaSystem, periods: readonly DashaPeriod[], birthUtc: string, convention?: DashaConvention): DashaResult {
  const first = periods[0], remainingMs = Date.parse(first.end) - Date.parse(birthUtc);
  const yearDays = convention?.yearDays ?? 365.25;
  return { system, method: convention?.method ?? DASHA_RULES[system].method, cycleYears: DASHA_RULES[system].cycleYears, yearDays, basisRef: convention?.basisRef ?? "natal/Moon",
    birthBalance: { lord: first.lord, fullStart: first.start, end: first.end, remainingMs, remainingYears: remainingMs / (yearDays * 86_400_000) }, periods };
}
export function calculationPeriods(result: AstrologyCalculation, system: DashaSystem): readonly DashaPeriod[] {
  return "dashas" in result ? result.dashas[system].periods : system === "vimshottari" ? result.periods : [];
}
export function periodAt(periods: readonly DashaPeriod[], instant: string) {
  const ms = Date.parse(instant);
  return periods.find(p => Date.parse(p.start) <= ms && ms < Date.parse(p.end));
}
export function findCalculationPeriod(result: AstrologyCalculation, key: string): DashaPeriod | undefined {
  const match = /^(vimshottari|yogini):([0-3]):(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu):(\d{4}-\d\d-\d\dT[\d:.]+Z)$/.exec(key);
  if (!match) return;
  const system = match[1] as DashaSystem, targetLevel = Number(match[2]);
  let periods = calculationPeriods(result, system);
  // Follow only the containing branch, rather than constructing every leaf.
  for (let level = 0; level <= targetLevel; level++) {
    const found = periodAt(periods, match[4]);
    if (!found) return;
    if (level === targetLevel) return found.lord === match[3] && found.start === match[4] ? found : undefined;
    periods = dashaChildren(found, system);
  }
}
/** References are local to one calculation ID; they are never URLs or commands. */
export function resolveCalculationRef(result: AstrologyCalculation, ref: string) {
  if (!("facts" in result) || typeof ref !== "string" || ref.length > 160) return;
  if (ref === "time/jdTT") return { ref, scale: "TT", julianDay: result.time.jdTT, method: result.time.method };
  if (ref === "dasha-time/jdUT" && "dashaBasis" in result && "time" in result.dashaBasis) return result.dashaBasis.time;
  if ("dashaBasis" in result && ref === result.dashaBasis.ref) return result.dashaBasis;
  if ("panchangaDetails" in result && ref.startsWith("panchanga/")) {
    const p = result.panchangaDetails;
    return [p.vara, ...Object.values(p.intervals), ...p.solarEvents].find(f => f.ref === ref);
  }
  if (ref.startsWith("dasha/")) {
    const parts = ref.split("/");
    return parts.length === 5 ? findCalculationPeriod(result, `${parts[1]}:${parts[2]}:${parts[3]}:${parts[4]}`) : undefined;
  }
  return [...result.facts.natal, ...Object.values(result.facts.vargas).flat()].find(f => f?.ref === ref);
}
