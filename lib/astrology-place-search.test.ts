import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../app/api/astrology/places/route";
import { parsePlaceCatalog, parsePlaceSearch, searchPlaceCatalog } from "./astrology/place-search";
import { extractCityText } from "../scripts/prepare-place-catalog.mjs";

const row = (overrides: Partial<Record<number, string>> = {}) => {
  const fields = ["123", "Test Town", "Test Town", "Testville,Тестоград", "42.87", "74.59", "P", "PPL", "KG", "", "01", "", "", "", "1000", "", "", "Asia/Bishkek", "2026-01-01"];
  for (const [index, value] of Object.entries(overrides)) if (value !== undefined) fields[Number(index)] = value;
  return fields.join("\t");
};
const administration = "KG.01\tTest Region\tTest Region\t12\nUS.AA\tAnother Region\tAnother Region\t13";

test("place catalog resolves Cyrillic aliases, region/country qualifiers and historical IANA zones", () => {
  const catalog = parsePlaceCatalog([row(), row({ 0: "124", 8: "US", 10: "AA", 17: "America/New_York", 14: "100000" })].join("\n"), administration);
  const places = searchPlaceCatalog(catalog, "  Тесто , Киргизия ", "ru");
  assert.equal(places.length, 1);
  assert.deepEqual(places[0], { id: 123, name: "Тестоград", label: "Тестоград, Test Region, Киргизия", country: "Киргизия", latitude: 42.87, longitude: 74.59, timezone: "Asia/Bishkek" });
  assert.equal(searchPlaceCatalog(catalog, "Test, KG", "en")[0].id, 123);
  assert.equal(searchPlaceCatalog(catalog, "Test, Another", "en")[0].id, 124);
  assert.equal(searchPlaceCatalog(catalog, "Test, US", "en")[0].timezone, "America/New_York");
  assert.equal(searchPlaceCatalog(catalog, "No such town", "ru").length, 0);
});

test("place search ranks exact aliases before population and caps broad matches without duplicate IDs", () => {
  const records = [row({ 0: "900", 1: "York", 2: "York", 3: "", 14: "1" }), ...Array.from({ length: 20 }, (_, i) => row({ 0: String(100 + i), 1: `York Town ${i}`, 2: `York Town ${i}`, 3: "", 14: String(1000 + i) }))];
  const catalog = parsePlaceCatalog([...records, records[0]].join("\n"), administration);
  const places = searchPlaceCatalog(catalog, "York", "en");
  assert.equal(places.length, 8); assert.equal(places[0].id, 900); assert.equal(places[1].id, 119);
  assert.equal(new Set(places.map(place => place.id)).size, 8);
  const accented = parsePlaceCatalog(row({ 1: "São-Test", 2: "Sao-Test", 3: "Сёло" }), administration);
  assert.equal(searchPlaceCatalog(accented, "sao test", "en").length, 1);
  assert.equal(searchPlaceCatalog(accented, "Село", "ru").length, 1);
});

test("untrusted catalog rows cannot supply malformed coordinates, names, zones or oversized data", () => {
  for (const invalid of [{ 0: "NaN" }, { 4: "" }, { 4: "91" }, { 4: "NaN" }, { 5: "181" }, { 1: "<script>" }, { 6: "A" }, { 8: "RUSSIA" }, { 17: "Unknown/Zone" }, { 17: "+06:00" }, { 17: "../../etc/passwd" }]) {
    assert.equal(parsePlaceCatalog(row(invalid), administration).length, 0);
  }
  assert.equal(parsePlaceCatalog("malformed\n" + row(), administration).length, 1);
  assert.throws(() => parsePlaceCatalog(row(), "x".repeat(1024 * 1024 + 1)), /places_unavailable/);
});

test("city input is bounded, supports only the selected locales and rejects malformed values", () => {
  assert.deepEqual(parsePlaceSearch("  New   York ", "en"), { query: "New York", language: "en" });
  for (const query of [null, {}, "", "a", "😀", "x".repeat(121), "Town\nprivate", "<script>", "town,country,extra"]) assert.throws(() => parsePlaceSearch(query, "en"), /invalid_query/);
  for (const language of [null, "zh", "EN", {}, "en&url=https://outside.invalid"]) assert.throws(() => parsePlaceSearch("Town", language), /invalid_query/);
});

test("place route denies foreign origins, unrelated hosts, unsupported fields and duplicate parameters", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const names = ["NODE_ENV", "ASTROLOGY_PREVIEW_ENABLED", "VERCEL"] as const;
  const before = Object.fromEntries(names.map(name => [name, environment[name]]));
  const base = "http://127.0.0.1:3110";
  const request = (query = "q=town&language=en", headers: Record<string, string> = {}) => new NextRequest(`${base}/api/astrology/places?${query}`, { headers: { host: "127.0.0.1:3110", origin: base, ...headers } });
  try {
    environment.NODE_ENV = "development";
    const deniedHeaders: Record<string, string>[] = [{ origin: "https://outside.invalid" }, { origin: "null" }, { host: "localhost:3110" }, { host: "outside.invalid" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of deniedHeaders) assert.equal((await GET(request(undefined, headers))).status, 403);
    const direct = new NextRequest(`${base}/api/astrology/places?q=x&language=en`, { headers: { host: "127.0.0.1:3110" } });
    assert.equal((await GET(direct)).status, 403);
    const sameOriginGet = new NextRequest(`${base}/api/astrology/places?q=x&language=en`, { headers: { host: "127.0.0.1:3110", "sec-fetch-site": "same-origin" } });
    assert.equal((await GET(sameOriginGet)).status, 400);
    for (const query of ["q=town", "q=town&language=zh", "q=x&language=en", "q=town&q=city&language=en", "q=town&language=en&language=ru", "q=town&language=en&birth=private", "q=" + "x".repeat(121) + "&language=en"]) {
      const response = await GET(request(query)); assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("set-cookie"), null);
      assert.deepEqual(await response.json(), { code: "invalid_query" });
    }
  } finally { for (const name of names) { if (before[name] === undefined) delete environment[name]; else environment[name] = before[name]; } }
});

function zipMember(name = "cities500.txt") {
  const data = Buffer.from("test"), filename = Buffer.from(name), checksum = 0xd87f7e0c;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(4, 18); local.writeUInt32LE(4, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(4, 20); central.writeUInt32LE(4, 24); central.writeUInt16LE(filename.length, 28);
  const footer = Buffer.alloc(22); footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(1, 8); footer.writeUInt16LE(1, 10); footer.writeUInt32LE(central.length + filename.length, 12); footer.writeUInt32LE(local.length + filename.length + data.length, 16);
  return Buffer.concat([local, filename, data, central, filename, footer]);
}

test("GeoNames preparation extracts only the fixed member and rejects corruption, oversized output and unsafe members", () => {
  assert.equal(extractCityText(zipMember()).toString("utf8"), "test");
  assert.throws(() => extractCityText(zipMember("../../cities500.txt")), /missing/);
  assert.throws(() => extractCityText(Buffer.from("not a zip")), /archive/);
  const corrupted = zipMember(); corrupted[43] ^= 1; assert.throws(() => extractCityText(corrupted), /checksum/);
  const oversized = zipMember(); oversized.writeUInt32LE(100 * 1024 * 1024, oversized.readUInt32LE(oversized.length - 6) + 24); assert.throws(() => extractCityText(oversized), /Unsafe/);
  const encrypted = zipMember(); encrypted.writeUInt16LE(1, encrypted.readUInt32LE(encrypted.length - 6) + 8); assert.throws(() => extractCityText(encrypted), /Unsafe/);
});
