import * as sweph from "sweph";
import { normalizeBirthInput } from "./contracts";
import { initializeEngine } from "./swiss-runtime";
import { lahiriPositions } from "./positions-core";
import { astronomyTime } from "./time-scales";
import { VARGA_METHODS } from "./facts";
import { TRANSIT_VERSION, normalizeTransitInput, type TransitResult } from "./transit-contract";

/** A transit moment is calculated independently of any saved natal snapshot. */
export function calculateTransit(raw: unknown): TransitResult {
  const input = normalizeTransitInput(raw), instant = normalizeBirthInput({ ...input, accuracy: "exact" });
  initializeEngine();
  const time = astronomyTime(instant, input.utcOffsetMinutes !== undefined);
  const { ascendant, planets, ayanamshaDegrees } = lahiriPositions(time, instant);
  return { version: TRANSIT_VERSION, input, instant, time, engineVersion: sweph.version(), ascendant, planets,
    settings: { ayanamsha: "Lahiri", swissMode: 1, ayanamshaDegrees, zodiac: "sidereal", houseSystem: "whole-sign", coordinates: "geocentric" },
    chart: { method: VARGA_METHODS.D1, ascendant, planets: planets.map(({ name, longitude, sign }) => ({ name, longitude, sign })) } };
}
