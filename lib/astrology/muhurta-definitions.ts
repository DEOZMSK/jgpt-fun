import type { DaySolarPeriod } from "./day-solar-periods";

export const MUHURTA_NAMES_METHOD = "do-ghati-traditional-names-v1";
export const MUHURTA_NAMES_SOURCE = "https://www.drikpanchang.com/muhurat/daily/do-ghati-muhurat.html";
export type MuhurtaQuality = "favorable" | "unfavorable" | "restricted";
// Traditional names and base classifications, not personalized electional advice.
const DAY_NAMES = ["Rudra", "Uraga", "Mitra", "Pitara", "Vasu", "Ambu", "Vishwedeva", "Vidhi", "Brahma", "Indra", "Indragni", "Daitya", "Varuna", "Aryama", "Bhaga"] as const;
const NIGHT_NAMES = ["Ishwara", "Ajaikapada", "Ahirbudhnya", "Pusha", "Ashwini", "Yama", "Agni", "Brahma", "Chandra", "Aditi", "Brihaspati", "Vishnu", "Surya", "Tvashta", "Samirana"] as const;
const UNFAVORABLE_DAY = new Set([0, 1, 3, 10, 11, 14]);
const UNFAVORABLE_NIGHT = new Set([0, 1, 5, 6]);

export function muhurtaDefinition(period: DaySolarPeriod) {
  if (period.kind !== "muhurta" || !period.half || !Number.isInteger(period.index) || period.index < 0 || period.index >= 15) return null;
  const night = period.half === "night";
  const quality: MuhurtaQuality = !night && period.index === 7 && period.weekday === 3 ? "restricted"
    : (night ? UNFAVORABLE_NIGHT : UNFAVORABLE_DAY).has(period.index) ? "unfavorable" : "favorable";
  return { name: (night ? NIGHT_NAMES : DAY_NAMES)[period.index], quality,
    restriction: quality === "restricted" ? "abhijit-wednesday" as const : null };
}
