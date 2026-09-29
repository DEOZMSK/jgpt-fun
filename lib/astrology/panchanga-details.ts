import { NAKSHATRAS } from "./contracts";
import { DASHA_LORDS, YOGAS, karanaName } from "./jyotish";
import type { MonthInterval } from "./month-panchanga-contract";
import type { PanchangaPart } from "./panchanga-contract";

export const PANCHANGA_DETAILS_METHOD = "traditional-limb-details-v1";
export const PANCHANGA_DETAIL_SOURCES = {
  tithi: "https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc229362.html",
  lords: "https://vedicastrologer.org/articles/vedic_astro_textbook.pdf",
  narada: "https://vedicpeople.com/puranas/maha-puranas/narada-purana/read/as-is-translation/chapter-056",
  nature: "https://www.drikpanchang.com/panchang/nakshatra/classification/nakshatra-seven-category.html",
} as const;

const TITHI_NAMES = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"] as const;
const TITHI_GROUPS = ["Nanda", "Bhadra", "Jaya", "Rikta", "Purna"] as const;
const TITHI_LORDS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu"] as const;
// Brihat Samhita 99.1-2. This is a named variant, not the Agni-first deity list.
const TITHI_DEITIES = ["Brahma", "Vidhata", "Vishnu", "Yama", "Chandra", "Subrahmanya", "Indra", "Vasu", "Sarpa", "Dharma", "Shiva", "Savita", "Manmatha", "Kali", "Vishwedeva"] as const;
const NAKSHATRA_DEITIES = ["Ashvins", "Yama", "Agni", "Brahma", "Chandra", "Rudra", "Aditi", "Brihaspati", "Sarpa", "Pitrs", "Bhaga", "Aryama", "Surya", "Tvashta", "Vayu", "Indragni", "Mitra", "Indra", "Nirriti", "Apas", "Vishwedeva", "Vishnu", "Vasu", "Varuna", "Ajaikapada", "Ahirbudhnya", "Pusha"] as const;
const NAKSHATRA_NATURES = ["quick", "fierce", "mixed", "fixed", "gentle", "sharp", "movable", "quick", "sharp", "fierce", "fierce", "fixed", "quick", "gentle", "movable", "mixed", "gentle", "sharp", "sharp", "fierce", "fixed", "movable", "movable", "movable", "fierce", "fixed", "gentle"] as const;
const YOGA_DEITIES = ["Yama", "Vishwedeva", "Chandra", "Dhata", "Brihaspati", "Chandra", "Indra", "Varuna", "Sarpa", "Agni", "Surya", "Bhumi", "Rudra", "Brahma", "Varuna", "Ganesha", "Rudra", "Kubera", "Tvashta", "Mitra", "Shadanana", "Savitri", "Kamala", "Gauri", "Ashvins", "Pitrs", "Aditi"] as const;
const KARANA_DEITIES: Readonly<Record<string, string>> = { Bava: "Indra", Balava: "Brahma", Kaulava: "Mitra", Taitila: "Aryama", Garaja: "Bhumi", Vanija: "Lakshmi", Vishti: "Yama", Shakuni: "Kali", Chatushpada: "Vrisha", Naga: "Sarpa", Kimstughna: "Vayu" };
const KARANA_NAMES = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga", "Kimstughna"];
const validIndex = (index: number, count: number) => Number.isInteger(index) && index >= 0 && index < count;

export function tithiDetails(index: number) {
  if (!validIndex(index, 30)) return null;
  const within = index % 15;
  return { name: index === 29 ? "Amavasya" : TITHI_NAMES[within], number: index + 1, pakshaNumber: within + 1,
    paksha: index < 15 ? "Shukla" : "Krishna", group: TITHI_GROUPS[within % 5],
    lord: index === 29 ? "Rahu" : TITHI_LORDS[within % 8], deity: index === 29 ? "Pitrs" : TITHI_DEITIES[within] };
}

export function nakshatraDetails(index: number) {
  return validIndex(index, 27) ? { name: NAKSHATRAS[index], number: index + 1,
    lord: DASHA_LORDS[index % 9], deity: NAKSHATRA_DEITIES[index], nature: NAKSHATRA_NATURES[index] } : null;
}

export function karanaDetails(index: number) {
  if (!validIndex(index, 60)) return null;
  const name = karanaName(index), fixed = index === 0 || index >= 57;
  return { name, number: KARANA_NAMES.indexOf(name) + 1, halfTithi: index + 1, half: index % 2 + 1, tithiIndex: Math.floor(index / 2), fixed, deity: KARANA_DEITIES[name],
    quality: name === "Vishti" ? "restricted" as const : fixed ? "activity-dependent" as const : "favorable" as const };
}

export function yogaDetails(index: number) {
  return validIndex(index, 27) ? { name: YOGAS[index], number: index + 1, deity: YOGA_DEITIES[index] } : null;
}

/** Narada 56.212b-215a, with one nadika explicitly defined as 24 elapsed minutes. */
export function yogaRestriction(index: number, start: number, end: number) {
  if (!validIndex(index, 27) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (index === 16 || index === 26) return { start, end, rule: "whole" as const, nadikas: null };
  if (index === 18) return { start, end: start + (end - start) / 2, rule: "first-half" as const, nadikas: null };
  const nadikas = ({ 0: 3, 14: 3, 5: 6, 9: 6, 12: 9, 8: 5 } as Record<number, number>)[index];
  return nadikas ? { start, end: Math.min(end, start + nadikas * 24 * 60000), rule: "initial-nadikas" as const, nadikas } : null;
}

/** Use the solver's saved half-open interval, including bounds outside the civil day. */
export function panchangaIntervalAt(intervals: readonly MonthInterval[], part: PanchangaPart, at: number): MonthInterval | null {
  if (!Number.isFinite(at)) return null;
  const count = part === "tithi" ? 30 : part === "karana" ? 60 : 27;
  const matching = intervals.filter(i => validIndex(i.index, count) && Date.parse(i.start.utc) <= at && at < Date.parse(i.end.utc));
  return matching.length === 1 ? matching[0] : null;
}
