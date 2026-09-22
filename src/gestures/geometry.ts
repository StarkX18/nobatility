import { FINGER_JOINTS, FINGER_NAMES, TIP_INDEX, type FingerName, type TrackedHand } from "../types";

export const GESTURES = [
  "none",
  "unknown",
  "pinch",
  "point",
  "open_palm",
  "fist",
  "peace",
  "thumbs_up",
] as const;

export type GestureName = (typeof GESTURES)[number];

export interface FingerFlags {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface HandFeatures {
  side: TrackedHand["side"];
  size: number;
  pinch: number;
  extended: FingerFlags;
  extendedCount: number;
}

function dist(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
): number {
  if (!a || !b) return 1;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function handSize(hand: TrackedHand): number {
  const wrist = hand.landmarks[0];
  const middleMcp = hand.landmarks[FINGER_JOINTS.middle[0]];
  const span = dist(wrist, middleMcp);
  return Math.max(0.04, span);
}

/** Tip well past the PIP relative to the MCP — scale-free curl test. */
export function fingerExtended(hand: TrackedHand, finger: FingerName): boolean {
  const joints = FINGER_JOINTS[finger];
  const wrist = hand.landmarks[0];
  const mcp = hand.landmarks[joints[0]];
  const pip = hand.landmarks[joints[1]];
  const tip = hand.landmarks[joints[3]];
  if (!wrist || !mcp || !pip || !tip) return false;

  const mcpToTip = dist(mcp, tip);
  const mcpToPip = dist(mcp, pip);
  const wristToTip = dist(wrist, tip);
  const wristToMcp = dist(wrist, mcp);

  if (finger === "thumb") {
    return mcpToTip > mcpToPip * 1.25 && wristToTip > wristToMcp * 0.85;
  }
  return wristToTip > wristToMcp * 1.12 && mcpToTip > mcpToPip * 1.45;
}

export function extractFeatures(hand: TrackedHand): HandFeatures {
  const size = handSize(hand);
  const thumb = hand.landmarks[TIP_INDEX.thumb];
  const index = hand.landmarks[TIP_INDEX.index];
  const pinch = dist(thumb, index) / size;
  const extended = {
    thumb: fingerExtended(hand, "thumb"),
    index: fingerExtended(hand, "index"),
    middle: fingerExtended(hand, "middle"),
    ring: fingerExtended(hand, "ring"),
    pinky: fingerExtended(hand, "pinky"),
  };
  return {
    side: hand.side,
    size,
    pinch,
    extended,
    extendedCount: FINGER_NAMES.filter((f) => extended[f]).length,
  };
}

export interface GestureScore {
  name: GestureName;
  confidence: number;
  scores: Partial<Record<GestureName, number>>;
  features: HandFeatures | null;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Soft scores in 0..1. Geometry owns this — no model. */
export function scoreGestures(features: HandFeatures): Partial<Record<GestureName, number>> {
  const e = features.extended;
  const pinch = clamp01((0.55 - features.pinch) / 0.4);
  const notPinch = 1 - pinch;
  const digits = (e.index ? 1 : 0) + (e.middle ? 1 : 0) + (e.ring ? 1 : 0) + (e.pinky ? 1 : 0);

  const fist = clamp01((1.2 - features.extendedCount) / 1.2) * notPinch;
  const open = clamp01((digits - 2.2) / 1.8) * notPinch * (e.index && e.pinky ? 1 : 0.7);
  const point =
    notPinch *
    (e.index ? 1 : 0.1) *
    (e.middle ? 0.15 : 1) *
    (e.ring ? 0.2 : 1) *
    (e.pinky ? 0.25 : 1);
  const peace =
    notPinch *
    (e.index && e.middle ? 1 : 0.1) *
    (e.ring ? 0.15 : 1) *
    (e.pinky ? 0.2 : 1);
  const thumbs =
    notPinch *
    (e.thumb ? 1 : 0.05) *
    (e.index ? 0.15 : 1) *
    (e.middle ? 0.15 : 1) *
    clamp01((2.2 - digits) / 2.2);

  return {
    pinch,
    fist,
    open_palm: open,
    point,
    peace,
    thumbs_up: thumbs,
  };
}

export function classifyHand(hand: TrackedHand): GestureScore {
  const features = extractFeatures(hand);
  const scores = scoreGestures(features);
  const ranked = (Object.entries(scores) as [GestureName, number][]).sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best[1] < 0.28) {
    return { name: "unknown", confidence: best?.[1] ?? 0, scores, features };
  }
  const margin = best[1] - (second?.[1] ?? 0);
  const confidence = clamp01(best[1] * 0.55 + margin * 0.9);
  return { name: best[0], confidence, scores, features };
}

export function classifyHands(hands: TrackedHand[]): GestureScore {
  if (!hands.length) {
    return { name: "none", confidence: 1, scores: { none: 1 }, features: null };
  }
  const right = hands.find((h) => h.side === "Right");
  const primary = right ?? hands[0]!;
  return classifyHand(primary);
}

export interface StableGesture extends GestureScore {
  stable: boolean;
  frames: number;
}

/** Majority hold so a twitch does not fire a gesture. */
export class GestureHold {
  private window: GestureName[] = [];
  private last: GestureName = "none";

  constructor(private size = 10) {}

  reset(): void {
    this.window = [];
    this.last = "none";
  }

  push(sample: GestureScore): StableGesture {
    this.window.push(sample.name);
    if (this.window.length > this.size) this.window.shift();
    const counts = new Map<GestureName, number>();
    for (const n of this.window) counts.set(n, (counts.get(n) ?? 0) + 1);
    let winner: GestureName = sample.name;
    let n = 0;
    for (const [name, c] of counts) {
      if (c > n) {
        n = c;
        winner = name;
      }
    }
    const stable = n >= Math.ceil(this.size * 0.6);
    if (stable) this.last = winner;
    return {
      ...sample,
      name: stable ? winner : this.last,
      stable,
      frames: n,
    };
  }
}
