import type { Vec2 } from "./types";

export interface ScreenMap {
  mirrorX: boolean;
  /** Crop of normalized camera space used as the playable reach. */
  inset: number;
}

export const DEFAULT_MAP: ScreenMap = {
  mirrorX: true,
  inset: 0.08,
};

/**
 * Map a normalized camera landmark (0..1, origin top-left of the frame)
 * onto overlay pixels. Mirroring matches a selfie camera so raising your
 * right hand lights the right side of the display.
 */
export function landmarkToScreen(
  point: Vec2,
  width: number,
  height: number,
  map: ScreenMap = DEFAULT_MAP,
): Vec2 {
  const inset = clamp(map.inset, 0, 0.45);
  const nx = map.mirrorX ? 1 - point.x : point.x;
  const x = remap(nx, inset, 1 - inset, 0, width);
  const y = remap(point.y, inset, 1 - inset, 0, height);
  return { x, y };
}

function remap(v: number, in0: number, in1: number, out0: number, out1: number): number {
  const t = (v - in0) / (in1 - in0);
  return out0 + clamp(t, 0, 1) * (out1 - out0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
