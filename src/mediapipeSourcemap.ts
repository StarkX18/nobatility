/** MediaPipe's published bundle points at a map file that is not in the npm package. */

const SOURCEMAPPING_URL = /\/\/[#@][ \t]*sourceMappingURL=[^\s]*/g;

export const EMPTY_SOURCEMAP =
  '{"version":3,"file":"","sources":[],"names":[],"mappings":""}';

export function stripSourceMappingUrl(code: string): string {
  return code.replace(SOURCEMAPPING_URL, "");
}

export function isMediapipeSourceMap(id: string): boolean {
  const file = id.split("?")[0] ?? id;
  return file.includes("@mediapipe/tasks-vision") && file.endsWith(".map");
}

export function isMediapipeBundle(id: string): boolean {
  const file = id.split("?")[0] ?? id;
  return file.includes("@mediapipe/tasks-vision") && /\.(mjs|cjs|js)$/.test(file);
}
