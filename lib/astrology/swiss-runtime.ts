import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as sweph from "sweph";

const HASHES: Readonly<Record<string, string>> = {
  "sepl_18.se1": "ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66",
  "semo_18.se1": "1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7"
};
let checked = false;

/** Every caller completes its Swiss work synchronously before yielding. */
export function initializeEngine() {
  const directory = path.join(process.cwd(), "work/astrology/ephe");
  if (!checked) {
    for (const [file, hash] of Object.entries(HASHES)) {
      if (createHash("sha256").update(readFileSync(path.join(directory, file))).digest("hex") !== hash) throw new Error("Ephemeris integrity check failed");
    }
    checked = true;
  }
  sweph.set_ephe_path(directory);
  sweph.set_sid_mode(sweph.constants.SE_SIDM_LAHIRI, 0, 0);
}
