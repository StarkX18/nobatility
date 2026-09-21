import { kinematicHand } from "./demoHands";
import { FINGER_JOINTS, TIP_INDEX, type TrackedHand, type Vec2 } from "../types";

/** Canonical aims for the four calibration corners (gnomic, toward-camera). */
export const CORNER_AIMS: readonly Vec2[] = [
  { x: -0.48, y: -0.34 },
  { x: 0.48, y: -0.34 },
  { x: 0.48, y: 0.34 },
  { x: -0.48, y: 0.34 },
];

export function setIndexAim(hand: TrackedHand, aim: Vec2): TrackedHand {
  const world = (hand.world ?? hand.landmarks).map((lm) => ({ ...lm }));
  const mcpI = FINGER_JOINTS.index[0];
  const mcp = world[mcpI];
  if (!mcp) {
    hand.world = world;
    return hand;
  }
  const mag = Math.hypot(aim.x, aim.y, 1);
  const u = { x: aim.x / mag, y: aim.y / mag, z: -1 / mag };
  for (let j = 1; j <= 3; j++) {
    const t = j / 3;
    world[mcpI + j] = {
      x: mcp.x + u.x * 0.95 * t,
      y: mcp.y + u.y * 0.95 * t,
      z: mcp.z + u.z * 0.95 * t,
    };
  }
  hand.world = world;
  return hand;
}

/** Shift a kinematic hand so its index tip sits on `tip` (camera 0..1). */
export function handWithIndexAt(side: TrackedHand["side"], tip: Vec2, aim?: Vec2): TrackedHand {
  const palm = { x: tip.x, y: Math.min(0.92, tip.y + 0.18) };
  const hand = kinematicHand(side, palm, {
    curl: 0.04,
    spread: 0.45,
    wave: 0,
    yaw: side === "Right" ? 0.12 : -0.12,
    scale: 0.2,
  });
  const cur = hand.landmarks[TIP_INDEX.index];
  if (cur) {
    const dx = tip.x - cur.x;
    const dy = tip.y - cur.y;
    hand.landmarks = hand.landmarks.map((lm) => ({ ...lm, x: lm.x + dx, y: lm.y + dy }));
  }
  if (aim) setIndexAim(hand, aim);
  return hand;
}

export function calibrationGuideHands(imageTip: Vec2, aim: Vec2): TrackedHand[] {
  const rest: Vec2 = { x: imageTip.x > 0.5 ? 0.32 : 0.68, y: 0.62 };
  return [handWithIndexAt("Left", rest), handWithIndexAt("Right", imageTip, aim)];
}
