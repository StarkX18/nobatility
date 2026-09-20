import { applyHomography, computeHomography, type Homography } from "./homography";
import type { Vec2 } from "./types";

export interface ScreenMap {
  mirrorX: boolean;
  /** Crop of normalized camera space used as the playable reach (uncalibrated). */
  inset: number;
  /** Camera (0..1) → screen (0..1). When set, inset/mirror are not used to project. */
  homography?: Homography | null;
}

export const DEFAULT_MAP: ScreenMap = {
  mirrorX: true,
  inset: 0.16,
  homography: null,
};

/**
 * Map a normalized camera landmark (0..1, origin top-left of the frame)
 * onto overlay CSS pixels.
 *
 * Uncalibrated: selfie-mirror + inset stretch (a guess).
 * Calibrated: the 4-corner homography from the last fit.
 */
export function landmarkToScreen(
  point: Vec2,
  width: number,
  height: number,
  map: ScreenMap = DEFAULT_MAP,
): Vec2 {
  if (map.homography) {
    const mapped = applyHomography(map.homography, point);
    if (!mapped) return { x: width / 2, y: height / 2 };
    return {
      x: clamp(mapped.x, 0, 1) * width,
      y: clamp(mapped.y, 0, 1) * height,
    };
  }

  const inset = clamp(map.inset, 0, 0.45);
  const nx = map.mirrorX ? 1 - point.x : point.x;
  const x = remap(nx, inset, 1 - inset, 0, width);
  const y = remap(point.y, inset, 1 - inset, 0, height);
  return { x, y };
}

/** Inverse of the uncalibrated (mirror + inset) map. */
export function screenToLandmark(
  point: Vec2,
  width: number,
  height: number,
  map: Pick<ScreenMap, "mirrorX" | "inset"> = DEFAULT_MAP,
): Vec2 {
  const inset = clamp(map.inset, 0, 0.45);
  const nx = remap(point.x, 0, width, inset, 1 - inset);
  const ny = remap(point.y, 0, height, inset, 1 - inset);
  return {
    x: map.mirrorX ? 1 - nx : nx,
    y: ny,
  };
}

export function mapFromHomography(H: Homography, mirrorX = true): ScreenMap {
  return { mirrorX, inset: DEFAULT_MAP.inset, homography: H };
}

function remap(v: number, in0: number, in1: number, out0: number, out1: number): number {
  const t = (v - in0) / (in1 - in0);
  return out0 + clamp(t, 0, 1) * (out1 - out0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export { computeHomography };
