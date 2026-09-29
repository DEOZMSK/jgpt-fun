import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "work/astrology/ephe");
const commit = "3fd0f956d73898b91cc4f67cf18b21af656d1342";
const files = {
  "sepl_18.se1": "ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66",
  "semo_18.se1": "1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7"
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Inspect each task-owned segment before traversing it. Do not follow an
// existing symlink/junction outside this checkout or overwrite user material.
let directory = root;
for (const segment of ["work", "astrology", "ephe"]) {
  directory = path.join(directory, segment);
  try { await mkdir(directory); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Ephemeris directory must be an ordinary project-local directory");
}
for (const [file, expected] of Object.entries(files)) {
  const destination = path.join(target, file);
  let existing;
  try {
    const info = await lstat(destination);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 4 * 1024 * 1024) throw new Error(`Unsafe ephemeris file: ${file}`);
    existing = await readFile(destination);
  }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (existing) {
    if (hash(existing) !== expected) throw new Error(`Existing ephemeris differs: ${file}. No file was overwritten.`);
    console.log(`Verified ${file}`);
    continue;
  }
  const response = await fetch(`https://raw.githubusercontent.com/aloistr/swisseph/${commit}/ephe/${file}`, {
    redirect: "error", signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok || !response.body) throw new Error(`Ephemeris download failed: ${file}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 4 * 1024 * 1024) throw new Error(`Ephemeris exceeds size limit: ${file}`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (hash(bytes) !== expected) throw new Error(`Ephemeris checksum mismatch: ${file}`);
  await writeFile(destination, bytes, { flag: "wx" });
  console.log(`Downloaded and verified ${file}`);
}
