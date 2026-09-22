import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import {
  EMPTY_SOURCEMAP,
  MEDIAPIPE_MAP_FILES,
  isMediapipeBundle,
  isMediapipeSourceMap,
  stripSourceMappingUrl,
  cleanModuleId,
} from "./src/mediapipeSourcemap";

function ensureMediapipeMaps(cwd = process.cwd()): void {
  const dir = join(cwd, "node_modules", "@mediapipe", "tasks-vision");
  if (!existsSync(join(dir, "vision_bundle.mjs"))) return;
  for (const name of MEDIAPIPE_MAP_FILES) {
    writeFileSync(join(dir, name), EMPTY_SOURCEMAP);
  }
}

ensureMediapipeMaps();

/**
 * @mediapipe/tasks-vision ships `//# sourceMappingURL=vision_bundle_mjs.js.map`
 * but not the file. Vite 6 follows that URL in extractSourcemapFromFile whenever
 * it loads the bundle via the default fs path (ENOENT → can stall the graph).
 *
 * Write stub maps on disk so that fs path cannot ENOENT, skip default load,
 * and strip the comment if anything still transforms the file.
 */
function mediapipeMissingSourcemapPlugin(): Plugin {
  return {
    name: "mediapipe-missing-sourcemap",
    enforce: "pre",
    configResolved() {
      ensureMediapipeMaps();
    },
    configureServer() {
      ensureMediapipeMaps();
    },
    buildStart() {
      ensureMediapipeMaps();
    },
    load(id) {
      if (isMediapipeSourceMap(id)) return EMPTY_SOURCEMAP;
      if (!isMediapipeBundle(id)) return;
      const file = cleanModuleId(id);
      if (!file) return;
      return stripSourceMappingUrl(readFileSync(file, "utf8"));
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
      plugins: [
        {
          name: "mediapipe-strip-sourcemap",
          setup(build) {
            build.onLoad({ filter: /vision_bundle\.(mjs|cjs)$/ }, (args) => {
              const mp =
                args.path.includes("@mediapipe/tasks-vision") ||
                args.path.includes(join("mediapipe", "tasks-vision"));
              if (!mp) return undefined;
              return {
                contents: stripSourceMappingUrl(readFileSync(args.path, "utf8")),
                loader: "js",
              };
            });
          },
        },
      ],
    },
  },
});
