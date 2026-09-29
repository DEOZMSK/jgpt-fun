import { VARGAS, type PlanetName, type Varga, type VargaChart } from "./contracts";

export const ASPECT_METHODS = ["graha-full-seven-v1", "rashi-sign-v1"] as const;
export type AspectMethod = typeof ASPECT_METHODS[number];
export type AspectSelection = { method: AspectMethod; varga: Varga };
export const emptyAspectSelection = (): AspectSelection => ({ method: "graha-full-seven-v1", varga: "D1" });
export function isAspectSelection(value: unknown): value is AspectSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && Object.hasOwn(item, "method") && Object.hasOwn(item, "varga")
    && (ASPECT_METHODS as readonly unknown[]).includes(item.method) && (VARGAS as readonly unknown[]).includes(item.varga);
}
const PLANETS: readonly PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const FULL_ASPECTS: Partial<Record<PlanetName, readonly number[]>> = {
  Sun: [7], Moon: [7], Mars: [4, 7, 8], Mercury: [7], Jupiter: [5, 7, 9], Venus: [7], Saturn: [3, 7, 10]
};
function sign(value: number) { if (!Number.isInteger(value) || value < 0 || value > 11) throw new RangeError("Invalid aspect sign"); return value; }

/** Full sign-count graha drishti of seven planets. Nodes do not cast in this named variant. */
export function grahaAspectSigns(planet: PlanetName, sourceSign: number): number[] {
  sign(sourceSign);
  if (!PLANETS.includes(planet)) throw new RangeError("Invalid aspect planet");
  return (FULL_ASPECTS[planet] ?? []).map(house => (sourceSign + house - 1) % 12);
}
/** Movable/fixed signs exclude their adjacent partner; dual signs aspect the other dual signs. */
export function rashiAspectSigns(sourceSign: number): number[] {
  sign(sourceSign);
  return Array.from({ length: 12 }, (_, target) => target).filter(target => {
    if (sourceSign % 3 === 2) return target % 3 === 2 && target !== sourceSign;
    return target % 3 === 1 - sourceSign % 3 && (target + 1) % 12 !== sourceSign && (sourceSign + 1) % 12 !== target;
  });
}

export type AspectRow = {
  ref: string; source: PlanetName; sourceSign: number; sourceRef: string;
  targetSign: number; targetHouse: number; countFromSource: number;
  occupants: { name: PlanetName | "Lagna"; ref: string }[];
};

/** Derive versioned relations from a saved chart; never mutate or recalculate its astronomical positions. */
export function chartAspects(chart: VargaChart, selection: AspectSelection) {
  if (!isAspectSelection(selection) || !Number.isFinite(chart.ascendant) || chart.ascendant < 0 || chart.ascendant >= 360
    || chart.planets.length !== 9 || new Set(chart.planets.map(p => p.name)).size !== 9
    || chart.planets.some(p => !PLANETS.includes(p.name) || !Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360 || p.sign !== Math.floor(p.longitude / 30))) {
    throw new RangeError("Invalid aspect chart");
  }
  const { varga, method } = selection, lagna = Math.floor(chart.ascendant / 30);
  const basis = `charts/${varga}`;
  const rows: AspectRow[] = [];
  for (const source of PLANETS) {
    const position = chart.planets.find(p => p.name === source)!;
    const targets = method === "graha-full-seven-v1" ? grahaAspectSigns(source, position.sign) : rashiAspectSigns(position.sign);
    for (const targetSign of targets) {
      const occupants: AspectRow["occupants"] = chart.planets.filter(p => p.sign === targetSign).map(p => ({ name: p.name, ref: `${basis}/planets/${p.name}` }));
      if (targetSign === lagna) occupants.unshift({ name: "Lagna", ref: `${basis}/ascendant` });
      rows.push({ ref: `aspects/${method}/${varga}/${source}/${targetSign}`, source, sourceSign: position.sign,
        sourceRef: `${basis}/planets/${source}`, targetSign, targetHouse: (targetSign - lagna + 12) % 12 + 1,
        countFromSource: (targetSign - position.sign + 12) % 12 + 1, occupants });
    }
  }
  return { version: "global-chart-aspects-v1" as const, method, varga, chartMethod: chart.method,
    basisRef: basis, houseConvention: "whole-sign-from-selected-chart-lagna" as const,
    coordinateKind: varga === "D1" ? "natal-sidereal" as const : "divisional-symbolic" as const, rows };
}
