export const FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type FingerName = (typeof FINGER_NAMES)[number];
export type HandSide = "Left" | "Right";

export const TIP_INDEX: Record<FingerName, number> = {
  thumb: 4,
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
};

export const FINGER_JOINTS: Record<FingerName, readonly [number, number, number, number]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

export const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];

export interface Vec2 {
  x: number;
  y: number;
}

export interface Landmark extends Vec2 {
  z: number;
}

export interface TrackedHand {
  side: HandSide;
  landmarks: Landmark[];
  score: number;
}

export interface FingerPointer {
  id: string;
  side: HandSide;
  finger: FingerName;
  x: number;
  y: number;
  z: number;
  pinch: boolean;
}

export interface FrameState {
  t: number;
  hands: TrackedHand[];
  pointers: FingerPointer[];
  fps: number;
  source: "camera" | "demo";
}

export function pointerId(side: HandSide, finger: FingerName): string {
  return `${side}-${finger}`;
}

export function fingertipsOf(hand: TrackedHand): FingerPointer[] {
  const thumb = hand.landmarks[TIP_INDEX.thumb];
  const index = hand.landmarks[TIP_INDEX.index];
  const pinch =
    thumb && index ? Math.hypot(thumb.x - index.x, thumb.y - index.y) < 0.055 : false;

  return FINGER_NAMES.map((finger) => {
    const tip = hand.landmarks[TIP_INDEX[finger]];
    return {
      id: pointerId(hand.side, finger),
      side: hand.side,
      finger,
      x: tip?.x ?? 0,
      y: tip?.y ?? 0,
      z: tip?.z ?? 0,
      pinch: finger === "index" || finger === "thumb" ? pinch : false,
    };
  });
}

export function pointersFromHands(hands: TrackedHand[]): FingerPointer[] {
  return hands.flatMap(fingertipsOf);
}
