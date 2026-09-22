import { describe, expect, it } from "vitest";
import {
  EMPTY_SOURCEMAP,
  isMediapipeBundle,
  isMediapipeSourceMap,
  stripSourceMappingUrl,
} from "../src/mediapipeSourcemap";
import { withTimeout } from "../src/hands/loadTimeout";

describe("stripSourceMappingUrl", () => {
  it("removes the comment Vite follows into a missing map", () => {
    const src = 'export{};\n//# sourceMappingURL=vision_bundle_mjs.js.map\n';
    expect(stripSourceMappingUrl(src)).toBe("export{};\n\n");
    expect(stripSourceMappingUrl(src)).not.toContain("sourceMappingURL");
  });

  it("strips the //@ form as well", () => {
    expect(stripSourceMappingUrl("code\n//@ sourceMappingURL=x.js.map")).toBe("code\n");
  });
});

describe("mediapipe path guards", () => {
  it("identifies the unpublished map next to the bundle", () => {
    expect(
      isMediapipeSourceMap("/node_modules/@mediapipe/tasks-vision/vision_bundle_mjs.js.map"),
    ).toBe(true);
    expect(isMediapipeBundle("/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs")).toBe(true);
    expect(isMediapipeBundle("/src/main.ts")).toBe(false);
  });

  it("ships an empty map Vite can parse without ENOENT", () => {
    const parsed = JSON.parse(EMPTY_SOURCEMAP) as { version: number; mappings: string };
    expect(parsed.version).toBe(3);
    expect(parsed.mappings).toBe("");
  });
});

describe("withTimeout", () => {
  it("rejects when the promise never settles", async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, "gpu landmarker")).rejects.toThrow(
      /timed out after 20ms/,
    );
  });

  it("resolves when the work finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "gpu")).resolves.toBe("ok");
  });
});
