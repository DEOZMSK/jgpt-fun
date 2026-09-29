import { NAKSHATRAS, type DashaPeriod, type Varga } from "./contracts";
import { additionalVargaLongitude } from "./varga-methods";

export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new RangeError("Longitude must be finite");
  return ((degrees % 360) + 360) % 360;
}

export function divisionalLongitude(longitude: number, varga: Varga): number {
  if (varga !== "D1" && varga !== "D9" && varga !== "D10") return additionalVargaLongitude(longitude, varga);
  const normalized = normalizeDegrees(longitude);
  if (varga === "D1") return normalized;
  if (varga === "D9") return normalizeDegrees(normalized * 9);
  const sign = Math.floor(normalized / 30);
  const withinSign = normalized % 30;
  const part = Math.floor(withinSign / 3);
  // Parashari Dashamsha: odd signs start from themselves; even signs from ninth.
  const startSign = sign + (sign % 2 === 0 ? 0 : 8);
  return normalizeDegrees((startSign + part) * 30 + (withinSign % 3) * 10);
}

export function nakshatraAt(longitude: number) {
  const position = normalizeDegrees(longitude) * 27 / 360;
  const index = Math.floor(position);
  return { index, name: NAKSHATRAS[index], pada: Math.floor((position - index) * 4) + 1 };
}

export const YOGAS = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"];
const MOVING_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];

export function karanaName(halfTithi: number) {
  return halfTithi === 0 ? "Kimstughna" : halfTithi === 57 ? "Shakuni"
    : halfTithi === 58 ? "Chatushpada" : halfTithi === 59 ? "Naga"
    : MOVING_KARANAS[(halfTithi - 1) % 7];
}
export function lunarPanchanga(sun: number, moon: number) {
  const elongation = normalizeDegrees(moon - sun);
  const karana = karanaName(Math.floor(elongation / 6));
  const nakshatra = nakshatraAt(moon);
  return { tithi: Math.floor(elongation / 12) + 1,
    paksha: elongation < 180 ? "Shukla" : "Krishna",
    nakshatra: nakshatra.name, pada: nakshatra.pada,
    yoga: YOGAS[Math.floor(normalizeDegrees(sun + moon) * 27 / 360)], karana };
}

export const DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"] as const;
const YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
export { DASHA_LEVELS, dashaChildren } from "./dasha";

export function vimshottariPeriods(moon: number, birthUtc: string, yearDays: 365.25 | 365.24219 = 365.25): DashaPeriod[] {
  const YEAR_MS = yearDays * 86_400_000;
  const birth = Date.parse(birthUtc);
  if (!Number.isFinite(birth)) throw new RangeError("Invalid birth instant");
  const position = normalizeDegrees(moon) * 27 / 360;
  const index = Math.floor(position) % 9;
  let start = birth - (position % 1) * YEARS[index] * YEAR_MS;
  return Array.from({ length: 9 }, (_, step) => {
    const lordIndex = (index + step) % 9;
    const end = start + YEARS[lordIndex] * YEAR_MS;
    const period = { lord: DASHA_LORDS[lordIndex], start: new Date(Math.round(start)).toISOString(), end: new Date(Math.round(end)).toISOString(), level: 0 };
    start = end;
    return period;
  });
}
