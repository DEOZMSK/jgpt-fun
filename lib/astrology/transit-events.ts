import { normalizeDegrees } from "./jyotish";

export const TRANSIT_EVENT_METHOD = "lahiri-ingress-station-scan-v1";
export const EVENT_TOLERANCE_SECONDS = 0.1;
export const EVENT_SCAN_DAYS = 1 / 8;
export type Motion = "direct" | "retrograde";
export type MovingPosition = { longitude: number; speed: number };
export type LocatedEvent = { kind: "ingress" | "station"; jd: number; bracket: [number, number]; longitude: number; speed: number;
  direction: Motion; fromSign: number; toSign: number };
export const motionAt = (speed: number): Motion => speed < 0 ? "retrograde" : "direct";
const arc = (value: number) => ((value + 540) % 360) - 180;

/** Bounded scan for the smooth supported planetary/node trajectories, not arbitrary oscillating functions. */
export function locateTransitEvents(start: number, end: number, position: (jd: number) => MovingPosition, stepDays = EVENT_SCAN_DAYS): LocatedEvent[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 370 || !Number.isFinite(stepDays) || stepDays <= 0 || stepDays > EVENT_SCAN_DAYS) throw new RangeError("Invalid transit event window");
  const count = Math.ceil((end - start) / stepDays);
  if (count > 20000) throw new RangeError("Transit scan limit exceeded");
  const cache = new Map<number, MovingPosition>();
  const at = (jd: number) => {
    let p = cache.get(jd);
    if (!p) {
      if (cache.size > 40000) throw new Error("Transit evaluation limit exceeded");
      p = position(jd);
      if (!Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360 || !Number.isFinite(p.speed) || Math.abs(p.speed) > 40) throw new Error("Invalid transit position");
      cache.set(jd, p);
    }
    return p;
  };
  const tolerance = EVENT_TOLERANCE_SECONDS / 86400;
  function root(a: number, b: number, f: (jd: number) => number): { jd: number; bracket: [number, number] } {
    let fa = f(a), fb = f(b);
    if (fa === 0) return { jd: a, bracket: [a, a] };
    if (fb === 0) return { jd: b, bracket: [b, b] };
    if (fa * fb >= 0) throw new Error("Transit root not bracketed");
    for (let n = 0; n < 60 && b - a > tolerance; n++) {
      const m = (a + b) / 2, fm = f(m);
      if (fm === 0) return { jd: m, bracket: [m, m] };
      if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return { jd: (a + b) / 2, bracket: [a, b] };
  }
  const result: LocatedEvent[] = [];
  const add = (event: LocatedEvent) => {
    if (event.jd < start || event.jd >= end) return;
    const duplicate = result.find(e => e.kind === event.kind && Math.abs(e.jd - event.jd) <= tolerance * 2);
    if (duplicate) {
      if (duplicate.direction !== event.direction || duplicate.fromSign !== event.fromSign || duplicate.toSign !== event.toSign) throw new Error("Unresolved neighboring transit events");
      return;
    }
    if (result.length >= 600) throw new Error("Transit event limit exceeded");
    result.push(event);
  };
  for (let n = 0; n < count; n++) {
    const a = start + n * stepDays, b = Math.min(end, start + (n + 1) * stepDays), pa = at(a), pb = at(b);
    if (Math.abs(arc(pb.longitude - pa.longitude)) > 10) throw new Error("Transit scan displacement exceeded");
    const cuts = [a, b];
    if (pa.speed * pb.speed <= 0 && !(pa.speed === 0 && pb.speed === 0)) {
      const station = root(a, b, jd => at(jd).speed), p = at(station.jd);
      const before = at(station.jd - 1 / 86400), after = at(station.jd + 1 / 86400);
      if (before.speed * after.speed < 0) {
        const sign = Math.floor(p.longitude / 30);
        add({ ...station, kind: "station", longitude: p.longitude, speed: p.speed, direction: motionAt(after.speed), fromSign: sign, toSign: sign });
        if (station.jd > a && station.jd < b) cuts.splice(1, 0, station.jd);
      }
    }
    for (let c = 0; c < cuts.length - 1; c++) {
      const lo = cuts[c], hi = cuts[c + 1], origin = at(lo).longitude, displacement = arc(at(hi).longitude - origin);
      if (displacement === 0) continue;
      const direction: Motion = displacement > 0 ? "direct" : "retrograde";
      // A hidden reversal or a speed/position inconsistency requires a finer method.
      const middle = at((lo + hi) / 2);
      if (Math.abs(middle.speed) > 1e-8 && motionAt(middle.speed) !== direction) throw new Error("Unresolved transit reversal");
      const lower = Math.min(origin, origin + displacement), upper = Math.max(origin, origin + displacement);
      for (let k = Math.ceil(lower / 30); k * 30 <= upper; k++) {
        const target = k * 30;
        const crossing = root(lo, hi, jd => origin + arc(at(jd).longitude - origin) - target);
        const p = at(crossing.jd), to = ((k + (direction === "direct" ? 0 : -1)) % 12 + 12) % 12, from = (to + (direction === "direct" ? 11 : 1)) % 12;
        // An extremum touching a sign boundary is not an ingress.
        if (crossing.jd === lo || crossing.jd === hi) {
          const before = Math.floor(at(crossing.jd - 1 / 86400).longitude / 30), after = Math.floor(at(crossing.jd + 1 / 86400).longitude / 30);
          if (before === after) continue;
          if (before !== from || after !== to) throw new Error("Unresolved boundary crossing");
        }
        add({ ...crossing, kind: "ingress", longitude: normalizeDegrees(target), speed: p.speed, direction, fromSign: from, toSign: to });
      }
    }
  }
  return result.sort((a, b) => a.jd - b.jd || a.kind.localeCompare(b.kind));
}
