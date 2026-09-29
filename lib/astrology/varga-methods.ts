import { VARGAS, type Varga } from "./contracts";

// Named research conventions, not a claim that a user's JHora options match.
// Sources, boundaries and the D30 longitude convention: docs/astrology-vargas.md.
export const VARGA_METHODS: Readonly<Record<Varga, string>> = {
  D1: "rashi-whole-sign-v1", D9: "parashari-navamsha-v1", D10: "parashari-dashamsha-v1",
  D2: "hora-sun-leo-moon-cancer-v1", D3: "parashari-trinal-drekkana-v1", D4: "parashari-kendra-chaturthamsha-v1",
  D5: "rao-parity-panchamsha-v1", D6: "rao-parity-shashthamsha-v1", D7: "parashari-saptamsha-v1",
  D8: "rao-modality-ashtamsha-v1", D11: "rao-reverse-start-rudramsha-v1", D12: "parashari-dwadashamsha-v1",
  D16: "rao-modality-shodashamsha-v1", D20: "rao-modality-vimshamsha-v1", D24: "rao-parity-siddhamsha-v1",
  D27: "rao-element-bhamsha-v1", D30: "parashari-trimshamsha-degree-units-v1",
  D40: "rao-parity-khavedamsha-v1", D45: "rao-modality-akshavedamsha-v1", D60: "rao-sign-start-shashtyamsha-v1"
};
export function isVarga(value: unknown): value is Varga { return typeof value === "string" && (VARGAS as readonly string[]).includes(value); }

/** New methods use half-open source intervals, including exact represented boundaries. */
export function additionalVargaLongitude(input: number, varga: Varga): number {
  if (!Number.isFinite(input)) throw new RangeError("Longitude must be finite");
  if (!isVarga(varga)) throw new RangeError("Unsupported divisional method");
  const remainder = input % 360, longitude = remainder < 0 ? remainder + 360 : remainder;
  const sign = Math.floor(longitude / 30), degree = longitude - sign * 30;
  const division = Number(varga.slice(1));
  // Compare against absolute boundaries rather than rounding a multiplied
  // quotient. A representable boundary and its immediate predecessor stay apart.
  let part = 0;
  while (part + 1 < division && longitude >= sign * 30 + (part + 1) * 30 / division) part++;
  const start = sign * 30 + part * 30 / division;
  const end = sign * 30 + (part + 1) * 30 / division;
  const fraction = (longitude - start) / (end - start);
  const odd = sign % 2 === 0;
  let target: number;
  switch (varga) {
    case "D2": target = odd === (part === 0) ? 4 : 3; break;
    case "D3": target = sign + part * 4; break;
    case "D4": target = sign + part * 3; break;
    case "D5": target = (odd ? [0, 10, 8, 2, 6] : [1, 5, 11, 9, 7])[part]; break;
    case "D6": case "D40": target = (odd ? 0 : 6) + part; break;
    case "D7": target = sign + (odd ? 0 : 6) + part; break;
    case "D8": case "D20": target = [0, 8, 4][sign % 3] + part; break;
    case "D11": target = (12 - sign) + part; break;
    case "D12": case "D60": target = sign + part; break;
    case "D16": case "D45": target = [0, 4, 8][sign % 3] + part; break;
    case "D24": target = (odd ? 4 : 3) + part; break;
    case "D27": target = [0, 3, 6, 9][sign % 4] + part; break;
    case "D30": {
      const ends = odd ? [5, 10, 18, 25, 30] : [5, 12, 20, 25, 30];
      target = (odd ? [0, 10, 8, 2, 6] : [1, 5, 11, 9, 7])[ends.findIndex(end => degree < end)];
      // Rao's progression paper p.8 footnote2: one degree is one longitude unit,
      // even where consecutive degrees map to the same sign. No rescaling of
      // unequal 5/7/8-degree sign groups and no interpretation of these degrees.
      break;
    }
    default: throw new RangeError("Use the preserved base divisional method");
  }
  const startDegree = ((target % 12) + 12) % 12 * 30, upper = startDegree + 30;
  // Floating-point addition can round a value just below a boundary into the
  // following sign. Keep the chosen half-open sign without rounding the input.
  return Math.min(startDegree + fraction * 30, upper - Number.EPSILON * upper);
}
