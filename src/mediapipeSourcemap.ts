/** MediaPipe's published bundle points at a map file that is not in the npm package. */

const SOURCEMAPPING_URL = /\/\/[#@][ \t]*sourceMappingURL=[^\s]*/g;

export const EMPTY_SOURCEMAP =
  '{"version":3,"file":"","sources":[],"names":[],"mappings":""}';

export const MEDIAPIPE_MAP_FILES = ["vision_bundle_mjs.js.map", "vision_bundle_cjs.js.map"] as const;

export function stripSourceMappingUrl(code: string): string {
  return code.replace(SOURCEMAPPING_URL, "");
}

/** Vite ids can be file URLs, have ?v= queries, or a trailing \0 suffix. */
export function cleanModuleId(id: string): string {
  let file = id.replace(/\0.*$/, "");
  file = (file.split("?")[0] ?? file).split("#")[0] ?? file;
  if (file.startsWith("file://")) file = file.slice("file://".length);
  return file;
}

export function isMediapipeSourceMap(id: string): boolean {
  const file = cleanModuleId(id);
  return file.includes("@mediapipe/tasks-vision") && file.endsWith(".map");
}

export function isMediapipeBundle(id: string): boolean {
  const file = cleanModuleId(id);
  return file.includes("@mediapipe/tasks-vision") && /vision_bundle\.(mjs|cjs|js)$/.test(file);
}
