import { VARGAS, type PlanetName, type Varga, type VargaChart } from "./contracts";
import { rashiAspectSigns } from "./aspects";

export const KARAKA_METHOD = "chara-eight-natal-rao-v1";
export const ARUDHA_METHOD = "bhava-rao-colords-v1";
export const GRAHA_ARUDHA_METHOD = "graha-rao-owner-strength-v1";
export const KARAKA_ROLES = ["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"] as const;
const PLANETS: readonly PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const LORDS: readonly PlanetName[] = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const EXALTATION: Record<PlanetName, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 2, Ketu: 8 };
const OWNED_SIGNS: Record<PlanetName, readonly number[]> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11],
  Venus: [1, 6], Saturn: [9, 10], Rahu: [10], Ketu: [7]
};
// Numerical equality only: 0.00000036 arcseconds, not an astrological orb.
const SAME_DEGREE = 1e-10;
const mod12 = (n: number) => (n % 12 + 12) % 12;
type Position = VargaChart["planets"][number];
type Positions = Record<PlanetName, Position>;
function positions(chart: VargaChart): Positions {
  if (!Number.isFinite(chart.ascendant) || chart.ascendant < 0 || chart.ascendant >= 360 || chart.planets.length !== 9
    || new Set(chart.planets.map(p => p.name)).size !== 9
    || chart.planets.some(p => !PLANETS.includes(p.name) || !Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360 || p.sign !== Math.floor(p.longitude / 30))) {
    throw new RangeError("Invalid analysis chart");
  }
  return Object.fromEntries(chart.planets.map(p => [p.name, p])) as Positions;
}
function advancement(p: Position) {
  const degree = p.longitude - p.sign * 30;
  return p.name === "Rahu" || p.name === "Ketu" ? 30 - degree : degree;
}

/** Chara ranks always use saved natal D1, never a divisional or dasha-basis longitude. */
export function charaKarakas(natal: VargaChart) {
  const byName = positions(natal);
  const ranked = PLANETS.filter(name => name !== "Ketu").map(name => ({ name, advancement: advancement(byName[name]),
    longitude: byName[name].longitude, sign: byName[name].sign, ref: `charts/D1/planets/${name}` }))
    .sort((a, b) => b.advancement - a.advancement);
  const rows = KARAKA_ROLES.map((role, index) => ({ role, rank: index + 1, ref: `karakas/${KARAKA_METHOD}/${role}`,
    planets: [] as typeof ranked, status: "vacant-after-tie" as "assigned" | "shared" | "vacant-after-tie" }));
  for (let i = 0; i < ranked.length;) {
    let end = i + 1;
    while (end < ranked.length && Math.abs(ranked[end].advancement - ranked[i].advancement) <= SAME_DEGREE) end++;
    rows[i].planets = ranked.slice(i, end); rows[i].status = end - i > 1 ? "shared" : "assigned";
    i = end;
  }
  return { version: "global-chara-karakas-v1" as const, method: KARAKA_METHOD, basisRef: "charts/D1", chartMethod: natal.method,
    comparisonToleranceDegrees: SAME_DEGREE, rows, requiresSthiraResolution: rows.some(row => row.status === "vacant-after-tie") };
}

export type ArudhaSelection = { method: typeof ARUDHA_METHOD; varga: Varga };
export const emptyArudhaSelection = (): ArudhaSelection => ({ method: ARUDHA_METHOD, varga: "D1" });
export function isArudhaSelection(value: unknown): value is ArudhaSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && Object.hasOwn(item, "method") && Object.hasOwn(item, "varga")
    && item.method === ARUDHA_METHOD && (VARGAS as readonly unknown[]).includes(item.varga);
}

/** Inclusive forward counts, then the tenth from the provisional first/seventh result. */
export function arudhaSign(source: number, lord: number) {
  if (![source, lord].every(s => Number.isInteger(s) && s >= 0 && s < 12)) throw new RangeError("Invalid arudha sign");
  const count = mod12(lord - source) + 1, provisional = mod12(lord + count - 1);
  const exception = provisional === source ? "first" : mod12(provisional - source) === 6 ? "seventh" : null;
  return { count, provisional, exception, sign: exception ? mod12(provisional + 9) : provisional };
}

export type GrahaStrengthRule = "single-sign" | "occupants" | "rashi-support" | "exalted-occupant" | "lord-oddity";
type GrahaStrengthCheck = { rule: Exclude<GrahaStrengthRule, "single-sign">; scores: number[] };

/** Rao 15.5.2's graha-specific comparison uses the planet itself as owner of both signs. */
function strongerOwnedSign(byName: Positions, planet: PlanetName) {
  const owned = OWNED_SIGNS[planet], checks: GrahaStrengthCheck[] = [];
  if (owned.length === 1) return { sign: owned[0], rule: "single-sign" as GrahaStrengthRule, checks };
  const all = PLANETS.map(name => byName[name]);
  const rules: { rule: GrahaStrengthCheck["rule"]; score: (sign: number) => number }[] = [
    { rule: "occupants", score: sign => all.filter(p => p.sign === sign).length },
    // These are three roles, so Mercury or Jupiter can count as both supporter and owner.
    { rule: "rashi-support", score: sign => (["Jupiter", "Mercury", planet] as PlanetName[]).filter(name => {
      const p = byName[name]; return p.sign === sign || rashiAspectSigns(p.sign).includes(sign);
    }).length },
    { rule: "exalted-occupant", score: sign => Number(all.some(p => p.sign === sign && EXALTATION[p.name] === sign)) },
    { rule: "lord-oddity", score: sign => Number(byName[planet].sign % 2 !== sign % 2) }
  ];
  for (const { rule, score } of rules) {
    const scores = owned.map(score); checks.push({ rule, scores });
    if (scores[0] !== scores[1]) return { sign: owned[scores[0] > scores[1] ? 0 : 1], rule, checks };
  }
  // The two signs have opposite parity and the same owner: rule four always resolves a tie.
  throw new RangeError("Unresolved owned-sign comparison");
}

/** Nine planetary padas; independent of bhava co-lord decisions and of the selected lagna. */
export function grahaArudhas(chart: VargaChart, varga: Varga) {
  if (!(VARGAS as readonly unknown[]).includes(varga)) throw new RangeError("Invalid graha arudha chart");
  const byName = positions(chart), basisRef = `charts/${varga}`;
  const rows = PLANETS.map(planet => {
    const sourceSign = byName[planet].sign, strength = strongerOwnedSign(byName, planet);
    return { planet, ref: `graha-arudhas/${GRAHA_ARUDHA_METHOD}/${varga}/${planet}`,
      planetRef: `${basisRef}/planets/${planet}`, sourceSign, ownedSigns: [...OWNED_SIGNS[planet]],
      selectedOwnedSign: strength.sign, strength: { owner: planet, rule: strength.rule, checks: strength.checks },
      ...arudhaSign(sourceSign, strength.sign) };
  });
  return { version: "global-graha-arudhas-v1" as const, method: GRAHA_ARUDHA_METHOD, varga, basisRef,
    chartMethod: chart.method, strengthMethod: "rao-graha-owned-signs-four-rules-v1" as const,
    coordinateKind: varga === "D1" ? "natal-sidereal" as const : "divisional-symbolic" as const,
    rows };
}

type LordMap = { Scorpio: "Mars" | "Ketu"; Aquarius: "Saturn" | "Rahu" };
const signLord = (sign: number, map: LordMap): PlanetName => sign === 7 ? map.Scorpio : sign === 10 ? map.Aquarius : LORDS[sign];
type StrengthRule = "outside-own-sign" | "companions" | "rashi-support" | "exaltation" | "sign-modality" | "advancement" | "tie";
type LordDecision = { winner: PlanetName | null; rule: StrengthRule; scores: number[] };
function compareColords(byName: Positions, owned: 7 | 10, map: LordMap): LordDecision {
  const names: [PlanetName, PlanetName] = owned === 7 ? ["Mars", "Ketu"] : ["Saturn", "Rahu"];
  const pair = names.map(name => byName[name]);
  const decide = (scores: number[], rule: StrengthRule): LordDecision | null => Math.abs(scores[0] - scores[1]) <= SAME_DEGREE ? null
    : { winner: names[scores[0] > scores[1] ? 0 : 1], rule, scores };
  const own = pair.map(p => p.sign === owned);
  if (own[0] !== own[1]) return { winner: names[own[0] ? 1 : 0], rule: "outside-own-sign", scores: own.map(v => v ? 0 : 1) };
  const all = Object.values(byName);
  const companions = pair.map(p => all.filter(other => other.name !== p.name && other.sign === p.sign).length);
  let decision = decide(companions, "companions"); if (decision) return decision;
  // Jupiter, Mercury and dispositor are three roles: a repeated planet counts twice, as in Rao's example.
  const support = pair.map(p => (["Jupiter", "Mercury", signLord(p.sign, map)] as PlanetName[]).filter(name => {
    const source = byName[name]; return source.sign === p.sign || rashiAspectSigns(source.sign).includes(p.sign);
  }).length);
  decision = decide(support, "rashi-support"); if (decision) return decision;
  decision = decide(pair.map(p => p.sign === EXALTATION[p.name] ? 1 : 0), "exaltation"); if (decision) return decision;
  decision = decide(pair.map(p => p.sign % 3), "sign-modality"); if (decision) return decision;
  return decide(pair.map(advancement), "advancement") ?? { winner: null, rule: "tie", scores: pair.map(advancement) };
}

/** Resolve both co-lords together; unresolved circular dependencies remain explicit alternatives. */
export function bhavaArudhas(chart: VargaChart, selection: ArudhaSelection) {
  if (!isArudhaSelection(selection)) throw new RangeError("Invalid arudha selection");
  const byName = positions(chart), basisRef = `charts/${selection.varga}`;
  const maps: LordMap[] = ["Mars", "Ketu"].flatMap(Scorpio => ["Saturn", "Rahu"].map(Aquarius => ({ Scorpio, Aquarius } as LordMap)));
  const evaluated = maps.map(map => ({ map, Scorpio: compareColords(byName, 7, map), Aquarius: compareColords(byName, 10, map) }));
  const consistent = evaluated.filter(row => (!row.Scorpio.winner || row.Scorpio.winner === row.map.Scorpio)
    && (!row.Aquarius.winner || row.Aquarius.winner === row.map.Aquarius));
  const candidates = consistent.length ? consistent : evaluated;
  const coLords = (["Scorpio", "Aquarius"] as const).map(sign => ({ sign,
    candidates: Array.from(new Set(candidates.map(row => row.map[sign]))),
    decisions: candidates.map(row => ({ assumed: row.map, ...row[sign] })) }));
  const lagna = Math.floor(chart.ascendant / 30);
  const rows = Array.from({ length: 12 }, (_, i) => {
    const sourceSign = mod12(lagna + i), lords = Array.from(new Set(candidates.map(row => signLord(sourceSign, row.map))));
    const options = lords.map(lord => ({ lord, lordSign: byName[lord].sign, lordRef: `${basisRef}/planets/${lord}`,
      ...arudhaSign(sourceSign, byName[lord].sign) }));
    const signs = Array.from(new Set(options.map(option => option.sign)));
    return { ref: `arudhas/${ARUDHA_METHOD}/${selection.varga}/A${i + 1}`, house: i + 1, label: i === 0 ? "AL" : i === 11 ? "UL" : `A${i + 1}`,
      sourceSign, options, sign: signs.length === 1 ? signs[0] : null, lordResolved: lords.length === 1 };
  });
  return { version: "global-bhava-arudhas-v1" as const, ...selection, basisRef, chartMethod: chart.method,
    houseConvention: "whole-sign-from-selected-chart-lagna" as const,
    coordinateKind: selection.varga === "D1" ? "natal-sidereal" as const : "divisional-symbolic" as const,
    coLordResolution: consistent.length === 0 ? "circular-unresolved" as const : consistent.length > 1 ? "multiple-or-tied" as const : "unique" as const,
    coLords, rows };
}
