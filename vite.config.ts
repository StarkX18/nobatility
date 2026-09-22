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
    },
    transform(code, id) {
      if (!isMediapipeBundle(id)) return;
      const next = stripSourceMappingUrl(code);
      if (next === code) return;
      return { code: next, map: null };
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
