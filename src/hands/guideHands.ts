import { kinematicHand } from "./demoHands";
import { TIP_INDEX, type TrackedHand, type Vec2 } from "../types";

/** Shift a kinematic hand so its index tip sits on `tip` (camera 0..1). */
export function handWithIndexAt(side: TrackedHand["side"], tip: Vec2): TrackedHand {
  const palm = { x: tip.x, y: Math.min(0.92, tip.y + 0.18) };
  const hand = kinematicHand(side, palm, {
    curl: 0.04,
    spread: 0.45,
    wave: 0,
    yaw: side === "Right" ? 0.12 : -0.12,
    scale: 0.2,
  });
  const cur = hand.landmarks[TIP_INDEX.index];
  if (!cur) return hand;
  const dx = tip.x - cur.x;
  const dy = tip.y - cur.y;
  hand.landmarks = hand.landmarks.map((lm) => ({ ...lm, x: lm.x + dx, y: lm.y + dy }));
  return hand;
}

export function calibrationGuideHands(indexAt: Vec2): TrackedHand[] {
  const rest: Vec2 = { x: indexAt.x > 0.5 ? 0.32 : 0.68, y: 0.62 };
  return [handWithIndexAt("Left", rest), handWithIndexAt("Right", indexAt)];
}
