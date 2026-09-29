import { DateTime } from "luxon";
import { TRANSIT_VERSION, type TransitResult } from "./transit-contract";
import { nakshatraAt, normalizeDegrees } from "./jyotish";
import { VARGA_METHODS } from "./facts";

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const label = (v: unknown, max = 80): v is string => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const finite = (v: unknown, bound: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= bound;
const degree = (v: unknown): v is number => finite(v, 360) && v >= 0 && v < 360;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Stored time uses recorded offsets; validation never asks current IANA or Swiss to recalculate it. */
export function validTransitResult(raw: unknown): raw is TransitResult {
  if (!rec(raw) || !keys(raw, ["version", "input", "instant", "time", "engineVersion", "settings", "ascendant", "planets", "chart"])
    || raw.version !== TRANSIT_VERSION || !rec(raw.input) || !rec(raw.instant) || !rec(raw.time) || !rec(raw.settings) || !label(raw.engineVersion)) return false;
  const i = raw.input, b = raw.instant, t = raw.time;
  const explicit = Object.hasOwn(i, "utcOffsetMinutes");
  if (!keys(i, ["date", "time", "place", "timezone", "latitude", "longitude", "nodes", ...(explicit ? ["utcOffsetMinutes"] : [])])
    || typeof i.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(i.date) || i.date < "1900-01-01" || i.date > "2100-12-31"
    || typeof i.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(i.time)
    || !label(i.place, 120) || i.place.trim() !== i.place || !label(i.timezone) || !finite(i.latitude, 89) || !finite(i.longitude, 180)
    || !["true", "mean"].includes(i.nodes as string) || (explicit && !finite(i.utcOffsetMinutes, 840)) || !finite(b.utcOffsetMinutes, 840)
    || typeof b.utc !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(b.utc)) return false;
  const utc = DateTime.fromISO(b.utc, { zone: "UTC" });
  if (!utc.isValid || utc.toISO() !== b.utc || utc.plus({ minutes: b.utcOffsetMinutes }).toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS") !== `${i.date}T${i.time}${i.time.length === 5 ? ":00" : ""}.000`) return false;
  const expected = { date: i.date, time: i.time, place: i.place, timezone: i.timezone, latitude: i.latitude, longitude: i.longitude, accuracy: "exact", nodes: i.nodes, utc: b.utc, utcOffsetMinutes: b.utcOffsetMinutes };
  if (!equal(b, expected) || (explicit && i.utcOffsetMinutes !== b.utcOffsetMinutes)) return false;
  if (!keys(t, ["method", "localTime", "secondsDefaulted", "timezone", "offsetMinutes", "offsetSelection", "utc", "jdTT", "jdUT1", "planetScale", "houseScale", "swissInputPolicy", "dataVersions"])
    || t.method !== "iana-luxon-swiss-utc-to-jd-v2" || t.localTime !== i.time || t.secondsDefaulted !== (i.time.length === 5)
    || t.timezone !== i.timezone || t.offsetMinutes !== b.utcOffsetMinutes || t.offsetSelection !== (explicit ? "explicit" : "unambiguous-iana") || t.utc !== b.utc
    || t.planetScale !== "TT" || t.houseScale !== "UT1" || t.swissInputPolicy !== (b.utc < "1972-01-01" ? "pre-1972-UT1" : "UTC-with-Swiss-UT1-fallback")
    || !finite(t.jdTT, 3000000) || !finite(t.jdUT1, 3000000) || Math.abs(t.jdTT - t.jdUT1) > 0.02
    || Math.abs(t.jdUT1 - (utc.toMillis() / 86400000 + 2440587.5)) > 2 / 86400 || !rec(t.dataVersions)) return false;
  const versions = t.dataVersions;
  if (!keys(versions, ["node", "icu", "tz", "luxon", "swiss", "leapSeconds"]) || !label(versions.node) || !label(versions.luxon)
    || ![versions.icu, versions.tz].every(v => v === null || label(v)) || versions.swiss !== raw.engineVersion || versions.leapSeconds !== "Swiss-bundled") return false;
  if (!degree(raw.settings.ayanamshaDegrees) || !equal(raw.settings, { ayanamsha: "Lahiri", swissMode: 1, ayanamshaDegrees: raw.settings.ayanamshaDegrees, zodiac: "sidereal", houseSystem: "whole-sign", coordinates: "geocentric" })
    || !degree(raw.ascendant) || !Array.isArray(raw.planets) || raw.planets.length !== 9) return false;
  const names = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  for (let n = 0; n < names.length; n++) {
    const p = raw.planets[n];
    if (!rec(p) || !degree(p.longitude) || !finite(p.speed, 30)) return false;
    const nak = nakshatraAt(p.longitude);
    if (!equal(p, { name: names[n], longitude: p.longitude, speed: p.speed, sign: Math.floor(p.longitude / 30), degree: p.longitude % 30, nakshatra: nak.name, pada: nak.pada })) return false;
  }
  if (raw.planets[8].longitude !== normalizeDegrees(raw.planets[7].longitude + 180) || raw.planets[8].speed !== raw.planets[7].speed) return false;
  return equal(raw.chart, { method: VARGA_METHODS.D1, ascendant: raw.ascendant, planets: raw.planets.map(({ name, longitude, sign }) => ({ name, longitude, sign })) });
}
