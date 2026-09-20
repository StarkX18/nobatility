import { describe, expect, it } from "vitest";
import { applyHomography, computeHomography, reprojectionError } from "../src/homography";
import { landmarkToScreen, screenToLandmark } from "../src/mapping";

describe("homography", () => {
  it("round-trips a perspective quad", () => {
    const pairs = [
      { src: { x: 0.2, y: 0.15 }, dst: { x: 0.1, y: 0.1 } },
      { src: { x: 0.7, y: 0.18 }, dst: { x: 0.9, y: 0.12 } },
      { src: { x: 0.78, y: 0.8 }, dst: { x: 0.88, y: 0.9 } },
      { src: { x: 0.18, y: 0.72 }, dst: { x: 0.12, y: 0.86 } },
    ];
    const H = computeHomography(pairs);
    expect(H).not.toBeNull();
    expect(reprojectionError(H!, pairs)).toBeLessThan(1e-8);
    const mid = applyHomography(H!, { x: 0.45, y: 0.4 });
    expect(mid).not.toBeNull();
    expect(mid!.x).toBeGreaterThan(0.2);
    expect(mid!.x).toBeLessThan(0.8);
  });

  it("maps identity corners to themselves", () => {
    const pairs = [
      { src: { x: 0, y: 0 }, dst: { x: 0, y: 0 } },
      { src: { x: 1, y: 0 }, dst: { x: 1, y: 0 } },
      { src: { x: 1, y: 1 }, dst: { x: 1, y: 1 } },
      { src: { x: 0, y: 1 }, dst: { x: 0, y: 1 } },
    ];
    const H = computeHomography(pairs)!;
    const p = applyHomography(H, { x: 0.25, y: 0.4 })!;
    expect(p.x).toBeCloseTo(0.25, 6);
    expect(p.y).toBeCloseTo(0.4, 6);
  });
});

describe("screen ↔ landmark", () => {
  it("inverts the uncalibrated selfie map", () => {
    const map = { mirrorX: true, inset: 0.1 };
    const cam = { x: 0.31, y: 0.44 };
    const screen = landmarkToScreen(cam, 1920, 1080, map);
    const back = screenToLandmark(screen, 1920, 1080, map);
    expect(back.x).toBeCloseTo(cam.x, 5);
    expect(back.y).toBeCloseTo(cam.y, 5);
  });

  it("uses the homography when calibrated", () => {
    const pairs = [
      { src: { x: 0.3, y: 0.3 }, dst: { x: 0.1, y: 0.1 } },
      { src: { x: 0.7, y: 0.3 }, dst: { x: 0.9, y: 0.1 } },
      { src: { x: 0.7, y: 0.7 }, dst: { x: 0.9, y: 0.9 } },
      { src: { x: 0.3, y: 0.7 }, dst: { x: 0.1, y: 0.9 } },
    ];
    const H = computeHomography(pairs)!;
    const p = landmarkToScreen({ x: 0.3, y: 0.3 }, 100, 100, {
      mirrorX: true,
      inset: 0.16,
      homography: H,
    });
    expect(p.x).toBeCloseTo(10, 4);
    expect(p.y).toBeCloseTo(10, 4);
  });
});
