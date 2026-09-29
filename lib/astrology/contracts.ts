import { DateTime, IANAZone } from "luxon";
import type { BirthPanchanga, PANCHANGA_METHOD } from "./panchanga-contract";

export const LEGACY_ASTROLOGY_VERSION = "global-jyotish-preview-v1";
export const PREVIOUS_ASTROLOGY_VERSION = "global-jyotish-core-v2";
export const SPLIT_ASTROLOGY_VERSION = "global-jyotish-split-v3";
export const VARGA_ASTROLOGY_VERSION = "global-jyotish-vargas-v4";
export const PANCHANGA_ASTROLOGY_VERSION = "global-jyotish-panchanga-v5";
export const ASTROLOGY_VERSION = "global-jyotish-geometric-dasha-v6";
export const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] as const;
export const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"] as const;
export const BASE_VARGAS = ["D1", "D9", "D10"] as const;
export const VARGAS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60"] as const;
export type BaseVarga = typeof BASE_VARGAS[number];
export type Varga = typeof VARGAS[number];
export type VargaMap<T> = Record<BaseVarga, T> & Partial<Record<Exclude<Varga, BaseVarga>, T>>;
export type PlanetName = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn" | "Rahu" | "Ketu";
export type NormalizedBirth = Readonly<{
  date: string; time: string; place: string; timezone: string;
  latitude: number; longitude: number; accuracy: "exact";
  nodes: "mean" | "true"; utc: string; utcOffsetMinutes: number;
}>;
export type PlanetPosition = Readonly<{
  name: PlanetName; longitude: number; speed: number;
  sign: number; degree: number; nakshatra: string; pada: number;
}>;
export type VargaChart = Readonly<{
  method: string; ascendant: number;
  planets: ReadonlyArray<{ name: PlanetName; longitude: number; sign: number }>;
}>;
export type DashaSystem = "vimshottari" | "yogini";
export type DashaPeriod = Readonly<{ lord: string; start: string; end: string; level: number; system?: DashaSystem; ref?: string }>;
export type DashaResult = Readonly<{
  system: DashaSystem; method: string; cycleYears: number; yearDays: 365.25 | 365.24219;
  basisRef: "natal/Moon" | "dasha-basis/Moon"; birthBalance: { lord: string; fullStart: string; end: string; remainingYears: number; remainingMs: number };
  periods: readonly DashaPeriod[];
}>;
export type ChartFact = Readonly<{
  ref: string; name: PlanetName | "Lagna"; longitude: number; sign: number; degree: number; house: number;
  speed: number | null; retrograde: boolean | null; nakshatra: string | null; pada: number | null;
  coordinateKind: "natal-sidereal" | "divisional-symbolic"; method: string; basisRef: string | null;
}>;
export type CalculationProfile = Readonly<{
  id: "global-lahiri-whole-sign"; version: 2; origin: "explicit-local-profile";
  ayanamsha: "Lahiri"; zodiac: "sidereal"; nodes: "mean" | "true"; houseSystem: "whole-sign"; yearDays: 365.25;
  methods: Record<BaseVarga | DashaSystem | "time", string>;
}>;
export type SplitCalculationProfile = Readonly<{
  id: "global-lahiri-pushya-whole-sign"; version: 3; origin: "explicit-local-profile";
  zodiac: "sidereal"; nodes: "mean" | "true"; houseSystem: "whole-sign";
  chart: { ayanamsha: "Lahiri"; swissMode: 1 };
  dashas: { ayanamsha: "Swiss True Pushya"; swissMode: 29; yearDays: Record<DashaSystem, 365.25 | 365.24219> };
  methods: Record<BaseVarga | DashaSystem | "time", string>;
}>;
export type VargaCalculationProfile = Omit<SplitCalculationProfile, "version" | "methods"> & Readonly<{
  version: 4; methods: Record<Varga | DashaSystem | "time", string>;
}>;
export type PanchangaCalculationProfile = Omit<VargaCalculationProfile, "version" | "methods"> & Readonly<{
  version: 5; methods: VargaCalculationProfile["methods"] & { panchanga: typeof PANCHANGA_METHOD };
}>;
export type GeometricDashaCalculationProfile = Omit<PanchangaCalculationProfile, "version" | "dashas"> & Readonly<{
  version: 6;
  dashas: SplitCalculationProfile["dashas"] & { positionKind: "geometric-geocentric"; timeMethod: "civil-as-ut-swiss-deltat-v1" };
}>;
export type DashaBasis = Readonly<{
  ref: "dasha-basis/Moon"; name: "Moon"; method: "swiss-true-pushya-v3";
  ayanamsha: "Swiss True Pushya"; swissMode: 29; ayanamshaDegrees: number;
  longitude: number; speed: number; nakshatra: string; pada: number; timeRef: "time/jdTT";
}>;
export type GeometricDashaBasis = Omit<DashaBasis, "method" | "timeRef"> & Readonly<{
  method: "swiss-true-pushya-geometric-civil-ut-v6";
  positionKind: "geometric-geocentric";
  tropicalLongitude: number;
  timeRef: "dasha-time/jdUT";
  time: Readonly<{ ref: "dasha-time/jdUT"; method: "civil-as-ut-swiss-deltat-v1"; jdUT: number; jdTT: number }>;
}>;
export type CalculationTime = Readonly<{
  method: "iana-luxon-swiss-utc-to-jd-v2"; localTime: string; secondsDefaulted: boolean;
  timezone: string; offsetMinutes: number; offsetSelection: "explicit" | "unambiguous-iana"; utc: string;
  jdTT: number; jdUT1: number; planetScale: "TT"; houseScale: "UT1";
  swissInputPolicy: "pre-1972-UT1" | "UTC-with-Swiss-UT1-fallback";
  dataVersions: { node: string; icu: string | null; tz: string | null; luxon: string; swiss: string; leapSeconds: "Swiss-bundled" };
}>;
type CalculationBase = Readonly<{
  engineVersion: string; birth: NormalizedBirth;
  settings: { ayanamsha: "Lahiri"; ayanamshaDegrees: number; zodiac: "sidereal"; houseSystem: "whole-sign"; yearDays: 365.25 | 365.24219 };
  julianDay: number; ascendant: number; planets: readonly PlanetPosition[];
  charts: VargaMap<VargaChart>;
  panchanga: { tithi: number; paksha: string; nakshatra: string; pada: number; yoga: string; karana: string; civilWeekday: string };
  periods: readonly DashaPeriod[]; warnings: readonly string[];
}>;
export type LegacyAstrologyCalculation = CalculationBase & { readonly version: typeof LEGACY_ASTROLOGY_VERSION };
export type AstrologyCalculationV2 = CalculationBase & Readonly<{
  version: typeof PREVIOUS_ASTROLOGY_VERSION; formatVersion: 2; profile: CalculationProfile; time: CalculationTime;
  facts: { natal: readonly ChartFact[]; vargas: VargaMap<readonly ChartFact[]> };
  dashas: Record<DashaSystem, DashaResult>;
}>;
export type AstrologyCalculationV3 = Omit<AstrologyCalculationV2, "version" | "formatVersion" | "profile"> & Readonly<{
  version: typeof SPLIT_ASTROLOGY_VERSION; formatVersion: 3; profile: SplitCalculationProfile; dashaBasis: DashaBasis;
}>;
export type AstrologyCalculationV4 = Omit<AstrologyCalculationV3, "version" | "formatVersion" | "profile" | "charts" | "facts"> & Readonly<{
  version: typeof VARGA_ASTROLOGY_VERSION; formatVersion: 4; profile: VargaCalculationProfile;
  charts: Record<Varga, VargaChart>; facts: { natal: readonly ChartFact[]; vargas: Record<Varga, readonly ChartFact[]> };
}>;
export type AstrologyCalculationV5 = Omit<AstrologyCalculationV4, "version" | "formatVersion" | "profile"> & Readonly<{
  version: typeof PANCHANGA_ASTROLOGY_VERSION; formatVersion: 5; profile: PanchangaCalculationProfile; panchangaDetails: BirthPanchanga;
}>;
export type CurrentAstrologyCalculation = Omit<AstrologyCalculationV5, "version" | "formatVersion" | "profile" | "dashaBasis"> & Readonly<{
  version: typeof ASTROLOGY_VERSION; formatVersion: 6; profile: GeometricDashaCalculationProfile; dashaBasis: GeometricDashaBasis;
}>;
export type AstrologyCalculation = LegacyAstrologyCalculation | AstrologyCalculationV2 | AstrologyCalculationV3 | AstrologyCalculationV4 | AstrologyCalculationV5 | CurrentAstrologyCalculation;

export class AstrologyInputError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export function normalizeBirthInput(value: unknown): NormalizedBirth {
  const reject = (code: string, message: string): never => { throw new AstrologyInputError(code, message); };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return reject("invalid_input", "Please check the birth details.");
  const input = value as Record<string, unknown>;
  const keys = ["date", "time", "place", "timezone", "latitude", "longitude", "accuracy", "nodes", "utcOffsetMinutes"];
  if (Object.keys(input).some((key) => !keys.includes(key))) return reject("invalid_input", "Unexpected birth details.");
  if (input.accuracy !== "exact") return reject("uncertain_time", "This preview needs an exact birth time. Approximate and unknown times require a separate uncertainty analysis.");
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < "1900-01-01" || input.date > "2100-12-31") return reject("invalid_date", "Choose a valid date between 1900 and 2100.");
  if (typeof input.time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.time)) return reject("invalid_time", "Enter the local birth time as HH:mm or HH:mm:ss.");
  if (typeof input.timezone !== "string" || input.timezone.length > 80 || !IANAZone.isValidZone(input.timezone)) return reject("invalid_timezone", "Enter an IANA time zone, for example Asia/Bishkek.");
  if (typeof input.latitude !== "number" || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 89) return reject("invalid_latitude", "Latitude must be between -89 and 89 degrees.");
  if (typeof input.longitude !== "number" || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) return reject("invalid_longitude", "Longitude must be between -180 and 180 degrees.");
  if (typeof input.place !== "string" || input.place.trim().length < 1 || input.place.length > 120 || /[\u0000-\u001f\u007f]/.test(input.place)) return reject("invalid_place", "Enter a place name of up to 120 characters.");
  if (input.nodes !== "mean" && input.nodes !== "true") return reject("invalid_nodes", "Choose mean or true lunar nodes.");
  const local = `${input.date}T${input.time}`;
  let datetime = DateTime.fromISO(local, { zone: input.timezone });
  if (!datetime.isValid || datetime.toFormat(input.time.length === 8 ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd'T'HH:mm") !== local) return reject("nonexistent_time", "This local time does not exist in the selected time zone. Check the date and clock change.");
  const offsets = datetime.getPossibleOffsets();
  const explicitOffset = input.utcOffsetMinutes;
  if (explicitOffset !== undefined && explicitOffset !== null) {
    if (typeof explicitOffset !== "number" || !Number.isFinite(explicitOffset) || Math.abs(explicitOffset) > 840) return reject("invalid_offset", "Check the UTC offset in minutes.");
    const selected = offsets.find((possible) => Math.abs(possible.offset - explicitOffset) < 1e-6);
    if (!selected) return reject("invalid_offset", "The UTC offset does not match this time zone and birth time.");
    datetime = selected;
  } else if (offsets.length > 1) return reject("ambiguous_time", "This local time occurs twice. Enter its confirmed UTC offset in minutes to select the correct occurrence.");
  return { date: input.date, time: input.time, place: input.place.trim(), timezone: input.timezone,
    latitude: input.latitude, longitude: input.longitude, accuracy: "exact", nodes: input.nodes,
    utc: datetime.toUTC().toISO()!, utcOffsetMinutes: datetime.offset };
}

export function isAstrologyPreviewEnabled(environment: Readonly<Record<string, string | undefined>>): boolean {
  return environment.NODE_ENV === "development"
    && environment.ASTROLOGY_PREVIEW_ENABLED === "true"
    && environment.VERCEL !== "1";
}
