import { FINGER_JOINTS, TIP_INDEX, type FingerName, type Landmark, type TrackedHand, type Vec2 } from "./types";

/**
 * Gnomic aim of a 3D bone: sideways / toward-camera.
 * Scale- and translation-invariant, so the same pointing pose maps the
 * same way whether the hand is near the lens or across the room.
 *
 * MediaPipe: smaller z is closer to the camera, so pointing at the display
 * (finger aimed at the webcam / screen) has tip.z < mcp.z.
 */
export function pointingAim(from: Landmark, to: Landmark): Vec2 {
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const vz = to.z - from.z;
  const planar = Math.hypot(vx, vy);
  const towardCamera = -vz;
  const depth = Math.max(1e-4, towardCamera, planar * 0.25);
  return { x: vx / depth, y: vy / depth };
}

export function fingerAim(hand: TrackedHand, finger: FingerName): Vec2 | null {
  const pts = hand.world ?? hand.landmarks;
  const mcpIndex = FINGER_JOINTS[finger][0];
  const mcp = pts[mcpIndex];
  const tip = pts[TIP_INDEX[finger]];
  if (!mcp || !tip) return null;
  return pointingAim(mcp, tip);
}

export function scaleLandmark(lm: Landmark, s: number, origin: Vec2): Landmark {
  return {
    x: origin.x + (lm.x - origin.x) * s,
    y: origin.y + (lm.y - origin.y) * s,
    z: lm.z * s,
  };
}
