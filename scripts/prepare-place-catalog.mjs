import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MiB = 1024 * 1024;
const maximumText = 96 * MiB;
const sources = {
  cities: "https://download.geonames.org/export/dump/cities500.zip",
  administration: "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
};
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function crc32(bytes) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = table[(checksum ^ byte) & 255] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

/** Read only a fixed ZIP member into memory. No archive-supplied path ever reaches the filesystem. */
export function extractCityText(zip) {
  if (!Buffer.isBuffer(zip) || zip.length < 22 || zip.length > 24 * MiB) throw Error("Invalid cities archive size");
  let footer = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { footer = i; break; }
  }
  if (footer < 0 || zip.readUInt16LE(footer + 4) || zip.readUInt16LE(footer + 6)) throw Error("Unsupported cities archive");
  const count = zip.readUInt16LE(footer + 10), directorySize = zip.readUInt32LE(footer + 12), directory = zip.readUInt32LE(footer + 16);
  if (count < 1 || count > 16 || count !== zip.readUInt16LE(footer + 8) || directory + directorySize !== footer) throw Error("Invalid cities archive directory");
  let position = directory, result;
  for (let index = 0; index < count; index++) {
    if (position + 46 > footer || zip.readUInt32LE(position) !== 0x02014b50) throw Error("Invalid ZIP member");
    const flags = zip.readUInt16LE(position + 8), method = zip.readUInt16LE(position + 10), checksum = zip.readUInt32LE(position + 16);
    const compressed = zip.readUInt32LE(position + 20), uncompressed = zip.readUInt32LE(position + 24), nameSize = zip.readUInt16LE(position + 28);
    const memberEnd = position + 46 + nameSize + zip.readUInt16LE(position + 30) + zip.readUInt16LE(position + 32);
    if (memberEnd > footer) throw Error("Invalid ZIP member boundary");
    const name = zip.toString("utf8", position + 46, position + 46 + nameSize);
    if (name === "cities500.txt") {
      if (result || flags & 1 || ![0, 8].includes(method) || uncompressed < 1 || uncompressed > maximumText || compressed > 24 * MiB) throw Error("Unsafe cities member");
      const local = zip.readUInt32LE(position + 42);
      if (local + 30 > directory || zip.readUInt32LE(local) !== 0x04034b50) throw Error("Invalid ZIP member offset");
      const localNameSize = zip.readUInt16LE(local + 26), body = local + 30 + localNameSize + zip.readUInt16LE(local + 28);
      if (body + compressed > directory || zip.toString("utf8", local + 30, local + 30 + localNameSize) !== name) throw Error("Invalid ZIP member data");
      result = method === 8 ? inflateRawSync(zip.subarray(body, body + compressed), { maxOutputLength: maximumText }) : zip.subarray(body, body + compressed);
      if (result.length !== uncompressed || crc32(result) !== checksum) throw Error("Cities archive checksum mismatch");
    }
    position = memberEnd;
  }
  if (position !== footer || !result) throw Error("Expected cities500.txt member is missing");
  new TextDecoder("utf-8", { fatal: true }).decode(result);
  return result;
}

async function download(url, maximum) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maximum) throw Error("GeoNames download failed or exceeds its size limit");
  const chunks = []; let bytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) { await reader.cancel(); throw Error("GeoNames download exceeds its size limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function preparePlaceCatalog() {
  let directory = root;
  for (const segment of [".generated", "places"]) {
    directory = path.join(directory, segment);
    try { await mkdir(directory); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw Error("Place catalog directory must be an ordinary project-local directory");
  }
  const names = ["cities500.txt", "admin1CodesASCII.txt", "catalog-source.json"];
  const existing = [];
  for (const name of names) {
    try {
      const info = await lstat(path.join(directory, name));
      if (!info.isFile() || info.isSymbolicLink() || info.size > (name === "cities500.txt" ? maximumText : MiB)) throw Error("Unsafe existing catalog file");
      existing.push(name);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (existing.length) {
    if (existing.length !== names.length) throw Error("An incomplete catalog already exists. It was preserved; inspect it before replacing any file.");
    const receipt = JSON.parse(await readFile(path.join(directory, "catalog-source.json"), "utf8"));
    for (const name of names.slice(0, 2)) {
      if (hash(await readFile(path.join(directory, name))) !== receipt.files?.[name]?.sha256) throw Error("Existing catalog differs from its receipt. No file was overwritten.");
    }
    console.log("Verified existing GeoNames catalog; no download or replacement."); return;
  }
  console.log("Downloading the fixed GeoNames cities500 (up to 24 MiB) and admin1 (up to 1 MiB) sources. Queries remain local.");
  const archive = await download(sources.cities, 24 * MiB);
  const cities = extractCityText(archive);
  const administration = await download(sources.administration, MiB);
  new TextDecoder("utf-8", { fatal: true }).decode(administration);
  const rows = cities.toString("utf8").trimEnd().split("\n").length;
  if (rows < 100_000 || rows > 350_000 || !administration.toString("utf8").includes("\t")) throw Error("GeoNames extract failed its completeness check");
  const receipt = {
    version: 1, downloadedAt: new Date().toISOString(), source: "GeoNames cities500", sources,
    license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", attributionUrl: "https://www.geonames.org/",
    rawRows: rows, files: Object.fromEntries([["cities500.txt", cities], ["admin1CodesASCII.txt", administration]].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }]))
  };
  await writeFile(path.join(directory, "cities500.txt"), cities, { flag: "wx" });
  await writeFile(path.join(directory, "admin1CodesASCII.txt"), administration, { flag: "wx" });
  await writeFile(path.join(directory, "catalog-source.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(`Prepared ${rows} GeoNames rows (${cities.length + administration.length} data bytes) in .generated/places. Existing files were not replaced.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparePlaceCatalog().catch(error => { console.error(error.message); process.exitCode = 1; });
}
