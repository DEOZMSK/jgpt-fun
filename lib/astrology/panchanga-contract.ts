export const PANCHANGA_METHOD = "lahiri-geocentric-panchanga-hindu-rise-v1";
export const PANCHANGA_PARTS = ["tithi", "nakshatra", "yoga", "karana"] as const;
export type PanchangaPart = typeof PANCHANGA_PARTS[number];
export const PANCHANGA_SOLVER_SECONDS = 0.05;
export const VARA_LORDS = ["Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Sun"] as const;
export type PanchangaInstant = Readonly<{ jd: number; scale: "TT" | "UT1"; utc: string;
  local: Readonly<{ dateTime: string; utcOffsetMinutes: number }> | null }>;
export type PanchangaInterval = Readonly<{
  ref: string; index: number; start: PanchangaInstant; end: PanchangaInstant;
  basisRefs: readonly string[];
}>;
export type SolarEvent = Readonly<{ ref: string; kind: "sunrise" | "sunset"; at: PanchangaInstant }>;
export type BirthPanchanga = Readonly<{
  method: typeof PANCHANGA_METHOD;
  ayanamsha: "Lahiri"; coordinateKind: "geocentric-sidereal";
  sunriseConvention: "swiss-hindu-center-no-refraction";
  calendarPolicy: "Swiss UTC or documented UT1 fallback";
  solverSeconds: typeof PANCHANGA_SOLVER_SECONDS;
  intervals: Record<PanchangaPart, PanchangaInterval>;
  civilDay: { date: string; timezone: string; start: PanchangaInstant; end: PanchangaInstant };
  solarEvents: readonly SolarEvent[];
  vara: Readonly<{ status: "available"; ref: "panchanga/vara"; weekday: number; lord: typeof VARA_LORDS[number]; localDate: string; utcOffsetMinutes: number;
    start: PanchangaInstant; end: PanchangaInstant; sunriseRefs: readonly [string, string] }>
    | Readonly<{ status: "unavailable"; ref: "panchanga/vara"; reason: "no-daily-sunrise-pair" }>;
}>;
