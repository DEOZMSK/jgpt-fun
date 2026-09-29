import { normalizeDegrees } from "./jyotish";

/** A bounded monotonic search for Sun/Moon phases, not retrograde transits. */
export function containingAngularInterval(at: number, divisions: number, phase: (jd: number) => number, toleranceSeconds = 0.05) {
  if (!Number.isFinite(at) || !Number.isInteger(divisions) || divisions < 1 || divisions > 108
    || !Number.isFinite(toleranceSeconds) || toleranceSeconds <= 0) throw new RangeError("Invalid angular interval request");
  const origin = normalizeDegrees(phase(at)), width = 360 / divisions;
  // Compare absolute boundaries instead of rounding a quotient near a boundary.
  let index = 0;
  while (index + 1 < divisions && origin >= (index + 1) * width) index++;
  const displacement = (jd: number) => {
    const delta = normalizeDegrees(phase(jd)) - origin;
    return delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
  };
  function root(target: number, direction: -1 | 1) {
    if (target === 0) return at;
    let near = at, nearValue = 0, far = at;
    for (let step = 1; step <= 12; step++) {
      far = at + direction * step / 4;
      const value = displacement(far);
      if ((value - nearValue) * direction <= 0) throw new Error("Non-monotonic lunar phase");
      if ((value - target) * direction >= 0) {
        let lo = Math.min(near, far), hi = Math.max(near, far);
        for (let n = 0; n < 60 && (hi - lo) * 86400 > toleranceSeconds; n++) {
          const mid = (lo + hi) / 2;
          if (displacement(mid) < target) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      }
      near = far; nearValue = value;
    }
    throw new Error("Lunar phase boundary not bracketed");
  }
  return { index, start: root(index * width - origin, -1), end: root((index + 1) * width - origin, 1) };
}
