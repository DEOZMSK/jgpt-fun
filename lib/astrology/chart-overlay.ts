import { DateTime } from "luxon";
import type { AstrologyCalculation, PlanetName } from "./contracts";
import { chartAspects, emptyAspectSelection } from "./aspects";
import { transitInput, transitOutdated, type TransitDraft, type TransitWorkspace } from "./transit-contract";

export const CHART_OVERLAYS = ["none", "aspects", "transits"] as const;
export type ChartOverlayMode = typeof CHART_OVERLAYS[number];
export const isChartOverlayMode = (v: unknown): v is ChartOverlayMode => (CHART_OVERLAYS as readonly unknown[]).includes(v);
export type ChartOverlay = { mode: "aspects" | "transits"; markers: { name: PlanetName; sign: number; ref: string }[] };

/** D1 overlays preserve the natal frame; a transit ascendant never rotates it. */
export function chartOverlay(natal: AstrologyCalculation, mode: ChartOverlayMode, transit: TransitWorkspace): ChartOverlay | null {
  if (mode === "aspects") return { mode, markers: chartAspects(natal.charts.D1, emptyAspectSelection()).rows.map(row => ({ name: row.source, sign: row.targetSign, ref: row.ref })) };
  if (mode !== "transits" || !overlayTransitReady(natal, transit)) return null;
  return { mode, markers: transit.result!.planets.map(p => ({ name: p.name, sign: p.sign, ref: `transit/${p.name}` })) };
}
export function overlayTransitReady(natal: AstrologyCalculation, transit: TransitWorkspace) {
  const r = transit.result, b = natal.birth;
  return !!r && !transitOutdated(transit) && r.input.nodes === b.nodes && r.input.timezone === b.timezone
    && r.input.latitude === b.latitude && r.input.longitude === b.longitude;
}

/** An explicit UTC instant resolves DST repeats without guessing birth time. */
export function overlayTransitDraft(natal: AstrologyCalculation, utc: string): TransitDraft {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(utc)) throw new RangeError("Invalid overlay UTC instant");
  const instant = DateTime.fromISO(utc, { zone: "UTC" });
  const local = instant.setZone(natal.birth.timezone), b = natal.birth;
  if (!instant.isValid || !local.isValid || local.year < 1900 || local.year > 2100) throw new RangeError("Invalid overlay UTC instant");
  const draft: TransitDraft = { date: local.toISODate()!, time: local.toFormat("HH:mm:ss"), timezone: b.timezone, place: b.place,
    latitude: String(b.latitude), longitude: String(b.longitude), nodes: b.nodes, utcOffsetMinutes: String(local.offset) };
  transitInput(draft);
  return draft;
}
