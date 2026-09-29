import * as sweph from "sweph";
import { VERSION as LUXON_VERSION } from "luxon";
import type { CalculationTime, NormalizedBirth } from "./contracts";

/** Civil-time validation is upstream. This layer only converts the resolved instant. */
export function astronomyTime(birth: NormalizedBirth, explicitOffset: boolean): CalculationTime {
  const d = new Date(birth.utc);
  const result = sweph.utc_to_jd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + d.getUTCMilliseconds() / 1000, sweph.constants.SE_GREG_CAL);
  if (result.flag < 0 || result.data.length !== 2 || result.data.some(n => !Number.isFinite(n))) throw new Error("Swiss time conversion unavailable");
  return { method: "iana-luxon-swiss-utc-to-jd-v2", localTime: birth.time, secondsDefaulted: birth.time.length === 5,
    timezone: birth.timezone, offsetMinutes: birth.utcOffsetMinutes, offsetSelection: explicitOffset ? "explicit" : "unambiguous-iana", utc: birth.utc,
    jdTT: result.data[0], jdUT1: result.data[1], planetScale: "TT", houseScale: "UT1",
    swissInputPolicy: d.getUTCFullYear() < 1972 ? "pre-1972-UT1" : "UTC-with-Swiss-UT1-fallback",
    dataVersions: { node: process.versions.node, icu: process.versions.icu ?? null, tz: process.versions.tz ?? null, luxon: LUXON_VERSION, swiss: sweph.version(), leapSeconds: "Swiss-bundled" } };
}
