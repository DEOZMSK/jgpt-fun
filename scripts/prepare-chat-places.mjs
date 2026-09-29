// Build an explicit public GeoNames asset packet; never traverse the personal archive.
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, ".generated", "places");
const target = path.join(root, ".generated", "chat-places");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const directory of [path.join(root, ".generated"), source]) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error("Expected ordinary GeoNames source directory");
}
const receiptPath = path.join(source, "catalog-source.json");
const info = await lstat(receiptPath);
if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error("Invalid GeoNames receipt");
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
if (receipt.source !== "GeoNames cities500" || receipt.sources?.cities !== "https://download.geonames.org/export/dump/cities500.zip"
  || receipt.sources?.administration !== "https://download.geonames.org/export/dump/admin1CodesASCII.txt") throw Error("Unexpected GeoNames source");
await mkdir(target, { recursive: true });
if ((await lstat(target)).isSymbolicLink()) throw Error("Asset target must be an ordinary directory");
let total = 0;
for (const name of ["cities500.txt", "admin1CodesASCII.txt"]) {
  const filename = path.join(source, name), stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > (name === "cities500.txt" ? 96 * 1024 * 1024 : 1024 * 1024)) throw Error("Unsafe GeoNames input");
  const bytes = await readFile(filename);
  if (hash(bytes) !== receipt.files?.[name]?.sha256) throw Error("GeoNames source differs from its receipt");
  const packed = gzipSync(bytes, { level: 9 }), output = path.join(target, `${name}.gz`);
  try {
    const previous = await lstat(output);
    if (!previous.isFile() || previous.isSymbolicLink() || previous.size !== packed.length || hash(await readFile(output)) !== hash(packed)) throw Error("Existing asset differs; preserved for inspection");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(output, packed, { flag: "wx" });
  }
  total += packed.length;
}
console.log(`Verified two compressed public GeoNames assets (${total} bytes). Source archive and personal records unchanged.`);
