import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export type PlaceSearchLanguage = "ru" | "en";
export type PlaceSearchResult = {
  id: number; name: string; label: string; country: string;
  latitude: number; longitude: number; timezone: string;
};
type CatalogPlace = PlaceSearchResult & {
  asciiName: string; aliases: string[]; normalizedAliases: string[];
  countryCode: string; admin: string; normalizedQualifiers: string[]; population: number;
};
export type PlaceCatalog = readonly CatalogPlace[];
export class PlaceSearchError extends Error {
  constructor(public readonly code: "invalid_query" | "places_unavailable") { super(code); this.name = "PlaceSearchError"; }
}
const MAX_RESULTS = 8;
const MAX_CATALOG_BYTES = 96 * 1024 * 1024;
const combiningMarks = new RegExp("\\p{M}", "gu");
const wordSeparators = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const cyrillic = new RegExp("\\p{Script=Cyrillic}", "u");
const normalize = (value: string) => value.normalize("NFKD").replace(combiningMarks, "").toLowerCase().replace(/ё/g, "е").replace(wordSeparators, " ").trim();
const text = (value: unknown, limit = 200): value is string => typeof value === "string" && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f<>]/.test(value);
const countries = { ru: new Intl.DisplayNames(["ru"], { type: "region" }), en: new Intl.DisplayNames(["en"], { type: "region" }) };
const countryLabels = new Map<string, string>();
const countryName = (code: string, language: PlaceSearchLanguage) => {
  const key = `${language}/${code}`;
  if (!countryLabels.has(key)) countryLabels.set(key, countries[language].of(code) || code);
  return countryLabels.get(key)!;
};

export function parsePlaceSearch(query: unknown, language: unknown): { query: string; language: PlaceSearchLanguage } {
  if (typeof query !== "string" || query.length > 120 || !text(query, 120) || !["ru", "en"].includes(language as string)) throw new PlaceSearchError("invalid_query");
  const clean = query.trim().replace(/\s+/g, " ");
  if (normalize(clean.split(",")[0]).length < 2 || clean.split(",").length > 2) throw new PlaceSearchError("invalid_query");
  return { query: clean, language: language as PlaceSearchLanguage };
}

/** Parse a public GeoNames extract. Only populated places with usable coordinates and IANA zones enter the index. */
export function parsePlaceCatalog(cities: string, administration: string): PlaceCatalog {
  if (Buffer.byteLength(cities) > MAX_CATALOG_BYTES || Buffer.byteLength(administration) > 1024 * 1024) throw new PlaceSearchError("places_unavailable");
  const admins = new Map<string, string>();
  for (const line of administration.split(/\r?\n/)) {
    const [code, name] = line.split("\t");
    if (/^[A-Z]{2}\.[A-Za-z0-9.]+$/.test(code) && text(name)) admins.set(code, name);
  }
  const zones = new Map<string, boolean>();
  const seen = new Set<number>();
  const result: CatalogPlace[] = [];
  const lines = cities.split(/\r?\n/);
  if (lines.length > 350_000) throw new PlaceSearchError("places_unavailable");
  for (const line of lines) {
    if (!line || line.startsWith("#") || line.length > 16_000) continue;
    const values = line.split("\t");
    if (values.length !== 19) continue;
    const [idRaw, name, asciiName, otherNames, latitudeRaw, longitudeRaw, featureClass, , countryCode] = values;
    const id = Number(idRaw), latitude = Number(latitudeRaw), longitude = Number(longitudeRaw), timezone = values[17];
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || featureClass !== "P" || !text(name) || !text(asciiName) || !/^[A-Z]{2}$/.test(countryCode)
      || !latitudeRaw || !longitudeRaw || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || !text(timezone, 80) || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(timezone)) continue;
    if (!zones.has(timezone)) { try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0); zones.set(timezone, true); } catch { zones.set(timezone, false); } }
    if (!zones.get(timezone)) continue;
    const aliases = Array.from(new Set([name, asciiName, ...otherNames.split(",")].filter(value => text(value))));
    const admin = admins.get(`${countryCode}.${values[10]}`) || "";
    result.push({ id, name, asciiName, aliases, normalizedAliases: aliases.map(normalize), countryCode, country: countryName(countryCode, "en"), admin,
      normalizedQualifiers: [countryCode, countryName(countryCode, "en"), countryName(countryCode, "ru"), admin].filter(Boolean).map(normalize),
      label: name, latitude, longitude, timezone,
      population: Number.isSafeInteger(Number(values[14])) && Number(values[14]) >= 0 ? Number(values[14]) : 0 });
    seen.add(id);
  }
  return result;
}

export function searchPlaceCatalog(catalog: PlaceCatalog, query: string, language: PlaceSearchLanguage): PlaceSearchResult[] {
  const input = parsePlaceSearch(query, language);
  const [needle, qualifier = ""] = input.query.split(",").map(normalize);
  const matches: { place: CatalogPlace; rank: number; alias: string }[] = [];
  for (const place of catalog) {
    if (qualifier && !place.normalizedQualifiers.some(value => value.startsWith(qualifier))) continue;
    let rank = 2, alias = "";
    for (let i = 0; i < place.normalizedAliases.length; i++) {
      const candidate = place.normalizedAliases[i];
      if (candidate === needle) { rank = 0; alias = place.aliases[i]; break; }
      if (rank > 1 && candidate.startsWith(needle)) { rank = 1; alias = place.aliases[i]; }
    }
    if (rank < 2) matches.push({ place, rank, alias });
  }
  matches.sort((a, b) => a.rank - b.rank || b.place.population - a.place.population || a.place.id - b.place.id);
  return matches.slice(0, MAX_RESULTS).map(({ place, alias }) => {
    const name = language === "ru" && cyrillic.test(alias) ? alias : language === "en" ? place.asciiName : place.name;
    const country = countryName(place.countryCode, language);
    const admin = place.normalizedAliases.includes(normalize(place.admin)) ? "" : place.admin;
    return { id: place.id, name, label: Array.from(new Set([name, admin, country].filter(Boolean))).join(", "), country,
      latitude: place.latitude, longitude: place.longitude, timezone: place.timezone };
  });
}

export type PlaceCatalogSource = "local" | "account";
const catalogs: Partial<Record<PlaceCatalogSource, Promise<PlaceCatalog>>> = {};
async function loadCatalog(source: PlaceCatalogSource): Promise<PlaceCatalog> {
  const root = process.cwd();
  let directory = root;
  for (const part of [".generated", source === "local" ? "places" : "chat-places"]) {
    directory = path.join(directory, part);
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new PlaceSearchError("places_unavailable");
  }
  const read = async (name: string, maximum: number) => {
    const filename = path.join(directory, source === "local" ? name : `${name}.gz`), info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw new PlaceSearchError("places_unavailable");
    const bytes = await readFile(filename);
    return source === "local" ? bytes.toString("utf8") : gunzipSync(bytes, { maxOutputLength: maximum }).toString("utf8");
  };
  const [cities, administration] = await Promise.all([read("cities500.txt", MAX_CATALOG_BYTES), read("admin1CodesASCII.txt", 1024 * 1024)]);
  const catalog = parsePlaceCatalog(cities, administration);
  if (catalog.length < 100_000) throw new PlaceSearchError("places_unavailable");
  return catalog;
}

export async function searchPlaces(query: string, language: PlaceSearchLanguage, source: PlaceCatalogSource = "local"): Promise<PlaceSearchResult[]> {
  parsePlaceSearch(query, language);
  try {
    catalogs[source] ??= loadCatalog(source).catch(error => { delete catalogs[source]; throw error; });
    return searchPlaceCatalog(await catalogs[source], query, language);
  } catch { throw new PlaceSearchError("places_unavailable"); }
}
