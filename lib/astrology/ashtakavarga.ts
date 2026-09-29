import { VARGAS, type Varga, type VargaChart } from "./contracts";

export const AV_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
export type AvPlanet = typeof AV_PLANETS[number];
export const AV_REFERENCES = [...AV_PLANETS, "Lagna"] as const;
export const AV_METHOD = "rao-unreduced-eight-reference-v1";
// Rao chapter12, tables19-25. Rows: inclusive houses1-12. Columns: AV_REFERENCES.
// 1 is a benefic point (rekha in this source); 0 contributes no point.
const TABLES: Record<AvPlanet, readonly (readonly number[])[]> = {
  Sun: [
    [1,0,1,0,0,0,1,0], [1,0,1,0,0,0,1,0], [0,1,0,1,0,0,0,1], [1,0,1,0,0,0,1,1],
    [0,0,0,1,1,0,0,0], [0,1,0,1,1,1,0,1], [1,0,1,0,0,1,1,0], [1,0,1,0,0,0,1,0],
    [1,0,1,1,1,0,1,0], [1,1,1,1,0,0,1,1], [1,1,1,1,1,0,1,1], [0,0,0,1,0,1,0,1]
  ],
  Moon: [
    [0,1,0,1,1,0,0,0], [0,0,1,0,1,0,0,0], [1,1,1,1,0,1,1,1], [0,0,0,1,1,1,0,0],
    [0,0,1,1,0,1,1,0], [1,1,1,0,0,0,1,1], [1,1,0,1,1,1,0,0], [1,0,0,1,1,0,0,0],
    [0,1,0,0,0,1,0,0], [1,1,1,1,1,1,0,1], [1,1,1,1,1,1,1,1], [0,0,0,0,0,0,0,0]
  ],
  Mars: [
    [0,0,1,0,0,0,1,1], [0,0,1,0,0,0,0,0], [1,1,0,1,0,0,0,1], [0,0,1,0,0,0,1,0],
    [1,0,0,1,0,0,0,0], [1,1,0,1,1,1,0,1], [0,0,1,0,0,0,1,0], [0,0,1,0,0,1,1,0],
    [0,0,0,0,0,0,1,0], [1,0,1,0,1,0,1,1], [1,1,1,1,1,1,1,1], [0,0,0,0,1,1,0,0]
  ],
  Mercury: [
    [0,0,1,1,0,1,1,1], [0,1,1,0,0,1,1,1], [0,0,0,1,0,1,0,0], [0,1,1,0,0,1,1,1],
    [1,0,0,1,0,1,0,0], [1,1,0,1,1,0,0,1], [0,0,1,0,0,0,1,0], [0,1,1,0,1,1,1,1],
    [1,0,1,1,0,1,1,0], [0,1,1,1,0,0,1,1], [1,1,1,1,1,1,1,1], [1,0,0,1,1,0,0,0]
  ],
  Jupiter: [
    [1,0,1,1,1,0,0,1], [1,1,1,1,1,1,0,1], [1,0,0,0,1,0,1,0], [1,0,1,1,1,0,0,1],
    [0,1,0,1,0,1,1,1], [0,0,0,1,0,1,1,1], [1,1,1,0,1,0,0,1], [1,0,1,0,1,0,0,0],
    [1,1,0,1,0,1,0,1], [1,0,1,1,1,1,0,1], [1,1,1,1,1,1,0,1], [0,0,0,0,0,0,1,0]
  ],
  Venus: [
    [0,1,0,0,0,1,0,1], [0,1,0,0,0,1,0,1], [0,1,1,1,0,1,1,1], [0,1,1,0,0,1,1,1],
    [0,1,0,1,1,1,1,1], [0,0,1,1,0,0,0,0], [0,0,0,0,0,0,0,0], [1,1,0,0,1,1,1,1],
    [0,1,1,1,1,1,1,1], [0,0,0,0,1,1,1,0], [1,1,1,1,1,1,1,1], [1,1,1,0,0,0,0,0]
  ],
  Saturn: [
    [1,0,0,0,0,0,0,1], [1,0,0,0,0,0,0,0], [0,1,1,0,0,0,1,1], [1,0,0,0,0,0,0,1],
    [0,0,1,0,1,0,1,0], [0,1,1,1,1,1,1,1], [1,0,0,0,0,0,0,0], [1,0,0,1,0,0,0,0],
    [0,0,0,1,0,0,0,0], [1,0,1,1,0,0,0,1], [1,1,1,1,1,1,1,1], [0,0,1,1,1,1,0,0]
  ]
};
export const AV_STAGES = ["original", "trikona", "ekadhipatya"] as const;
export type AvSelection = { method: typeof AV_METHOD; varga: Varga; target: "SAV" | AvPlanet; stage: typeof AV_STAGES[number] };
export const emptyAvSelection = (): AvSelection => ({ method: AV_METHOD, varga: "D1", target: "SAV", stage: "original" });
export function isAvSelection(value: unknown): value is AvSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 4 && ["method", "varga", "target", "stage"].every(key => Object.hasOwn(row, key))
    && row.method === AV_METHOD && (VARGAS as readonly unknown[]).includes(row.varga)
    && (AV_STAGES as readonly unknown[]).includes(row.stage)
    && (["SAV", ...AV_PLANETS] as readonly unknown[]).includes(row.target);
}

/** Unreduced prastara -> seven BAVs -> SAV; nodes are neither targets nor references. */
export function ashtakavarga(chart: VargaChart, varga: Varga) {
  const allNames = [...AV_PLANETS, "Rahu", "Ketu"];
  if (!(VARGAS as readonly string[]).includes(varga) || !Number.isFinite(chart.ascendant) || chart.ascendant < 0 || chart.ascendant >= 360
    || chart.planets.length !== 9 || new Set(chart.planets.map(p => p.name)).size !== 9
    || chart.planets.some(p => !allNames.includes(p.name) || !Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360 || p.sign !== Math.floor(p.longitude / 30))) {
    throw new RangeError("Invalid ashtakavarga chart");
  }
  const basisRef = `charts/${varga}`;
  const references = AV_REFERENCES.map(name => ({ name, sign: name === "Lagna" ? Math.floor(chart.ascendant / 30) : chart.planets.find(p => p.name === name)!.sign,
    ref: name === "Lagna" ? `${basisRef}/ascendant` : `${basisRef}/planets/${name}` }));
  const bav = AV_PLANETS.map(planet => {
    const prastara = references.map((reference, col) => ({ ...reference,
      points: Array.from({ length: 12 }, (_, sign) => TABLES[planet][(sign - reference.sign + 12) % 12][col]) }));
    const points = Array.from({ length: 12 }, (_, sign) => prastara.reduce((sum, row) => sum + row.points[sign], 0));
    return { planet, ref: `ashtakavarga/${AV_METHOD}/${varga}/${planet}`, points, total: points.reduce((a, b) => a + b, 0), prastara };
  });
  const points = Array.from({ length: 12 }, (_, sign) => bav.reduce((sum, row) => sum + row.points[sign], 0));
  return { version: "global-ashtakavarga-v1" as const, method: AV_METHOD, varga, chartMethod: chart.method, basisRef,
    coordinateKind: varga === "D1" ? "natal-sidereal" as const : "divisional-symbolic" as const,
    reduction: "none" as const, pointMeaning: "benefic-one" as const, bav,
    sav: { ref: `ashtakavarga/${AV_METHOD}/${varga}/SAV`, points, total: points.reduce((a, b) => a + b, 0) } };
}
