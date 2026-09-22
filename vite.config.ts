import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import {
  EMPTY_SOURCEMAP,
  isMediapipeBundle,
  isMediapipeSourceMap,
  stripSourceMappingUrl,
} from "./src/mediapipeSourcemap";

/**
 * @mediapipe/tasks-vision ships `//# sourceMappingURL=vision_bundle_mjs.js.map`
 * but not the file. Vite 6 follows that URL during loadAndTransform (especially
 * when the package is optimizeDeps.exclude'd) and ENOENT can stall the module graph.
 */
function mediapipeMissingSourcemapPlugin(): Plugin {
  return {
    name: "mediapipe-missing-sourcemap",
    enforce: "pre",
    load(id) {
      if (isMediapipeSourceMap(id)) return EMPTY_SOURCEMAP;
      if (!isMediapipeBundle(id)) return;
      const file = id.split("?")[0];
      if (!file) return;
      // Returning stripped code skips Vite's fs path, which otherwise follows
      // sourceMappingURL into extractSourcemapFromFile and ENOENT.
      return stripSourceMappingUrl(readFileSync(file, "utf8"));
    },
  };
}

export default defineConfig({
  plugins: [mediapipeMissingSourcemapPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["@mediapipe/tasks-vision"],
    esbuildOptions: {
      sourcemap: false,
    },
  },
});
