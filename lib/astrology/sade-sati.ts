import type { PanchangaInstant } from "./panchanga-contract";
import { SADE_SATI_METHOD, type SaturnTransitResult } from "./saturn-transit-contract";
import { EVENT_TOLERANCE_SECONDS, locateTransitEvents, type LocatedEvent, type MovingPosition } from "./transit-events";

/** Scan contiguous bounded windows, with overlap to reconcile roots near a window edge. */
export function locateSaturnIngresses(start: number, end: number, position: (jd: number) => MovingPosition): LocatedEvent[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 73416) throw new RangeError("Invalid Saturn transit range");
  const result: LocatedEvent[] = [], overlap = 1 / 86400;
  for (let a = start; a < end; a += 365) {
    const b = Math.min(end, a + 365);
    for (const event of locateTransitEvents(a - overlap, b + overlap, position)) {
      if (event.kind !== "ingress" || event.jd < start || event.jd >= end) continue;
      const previous = result.at(-1);
      if (previous && Math.abs(previous.jd - event.jd) * 86400 <= EVENT_TOLERANCE_SECONDS * 2) {
        if (previous.fromSign !== event.fromSign || previous.toSign !== event.toSign || previous.direction !== event.direction) throw new Error("Conflicting Saturn boundary events");
        continue;
      }
      if (previous && previous.jd >= event.jd) throw new Error("Unordered Saturn events");
      if (result.length >= 1000) throw new Error("Saturn event limit exceeded");
      result.push(event);
    }
  }
  return result;
}

export type SadeSatiPhase = 12 | 1 | 2;
export function sadeSatiPhase(saturnSign: number, moonSign: number): SadeSatiPhase | null {
  if (![saturnSign, moonSign].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new RangeError("Invalid sign");
  const relative = (saturnSign - moonSign + 12) % 12 + 1;
  return relative === 12 || relative === 1 || relative === 2 ? relative : null;
}
export type SadeSatiInterval = {
  ref: string; method: typeof SADE_SATI_METHOD; phase: SadeSatiPhase; saturnSign: number;
  start: PanchangaInstant; end: PanchangaInstant; startRef: string; endRef: string;
  clippedStart: boolean; clippedEnd: boolean; entryDirection: "direct" | "retrograde" | null;
  episode: number;
};

/** Derive sign occupancy from two saved facts; never recompute a natal Moon or a transit. */
export function sadeSatiIntervals(timeline: SaturnTransitResult, moonLongitude: number): SadeSatiInterval[] {
  if (!Number.isFinite(moonLongitude) || moonLongitude < 0 || moonLongitude >= 360) throw new RangeError("Invalid natal Moon");
  const moonSign = Math.floor(moonLongitude / 30), result: SadeSatiInterval[] = [];
  let sign = Math.floor(timeline.initialLongitude / 30), start = timeline.start, startRef = "saturn-range/start";
  let direction: "direct" | "retrograde" | null = null, episode = 0, previousActive = false;
  const append = (end: PanchangaInstant, endRef: string) => {
    if (end.jd <= start.jd) return;
    const phase = sadeSatiPhase(sign, moonSign);
    if (phase !== null) {
      if (!previousActive) episode++;
      result.push({ ref: `sade-sati/${result.length}`, method: SADE_SATI_METHOD, phase, saturnSign: sign, start, end, startRef, endRef,
        clippedStart: startRef === "saturn-range/start", clippedEnd: endRef === "saturn-range/end", entryDirection: direction, episode });
    }
    previousActive = phase !== null;
  };
  for (const event of timeline.events) {
    // An event at the range edge may be within the solver tolerance of its initial position.
    if (event.at.jd - timeline.start.jd <= EVENT_TOLERANCE_SECONDS / 86400) sign = event.fromSign;
    append(event.at, event.ref);
    sign = event.toSign; start = event.at; startRef = event.ref; direction = event.direction;
  }
  append(timeline.end, "saturn-range/end");
  return result;
}
