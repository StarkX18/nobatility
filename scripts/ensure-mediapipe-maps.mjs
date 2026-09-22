import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EMPTY = '{"version":3,"file":"","sources":[],"names":[],"mappings":""}';
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "@mediapipe", "tasks-vision");
if (existsSync(join(dir, "vision_bundle.mjs"))) {
  for (const name of ["vision_bundle_mjs.js.map", "vision_bundle_cjs.js.map"]) {
    writeFileSync(join(dir, name), EMPTY);
  }
}
