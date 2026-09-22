import { FINGER_JOINTS, FINGER_NAMES, type FingerName, type Landmark, type TrackedHand } from "../types";

function lm(x: number, y: number, z = 0): Landmark {
  return { x, y, z };
}

/**
 * Build a plausible 21-point MediaPipe-style hand from a palm pose.
 * Used for the camera-free demo so the overlay can be tuned visually.
 */
export function kinematicHand(
  side: TrackedHand["side"],
  palm: { x: number; y: number },
  opts: {
    spread?: number;
    curl?: number;
    wave?: number;
    yaw?: number;
    scale?: number;
  } = {},
): TrackedHand {
  const spread = opts.spread ?? 1;
  const curl = opts.curl ?? 0.15;
  const wave = opts.wave ?? 0;
  const yaw = opts.yaw ?? 0;
  const scale = opts.scale ?? 0.22;
  const sign = side === "Right" ? 1 : -1;

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rot = (dx: number, dy: number, dz = 0): Landmark =>
    lm(palm.x + (dx * cos - dy * sin) * scale, palm.y + (dx * sin + dy * cos) * scale, dz);

  const wrist = rot(0, 0.42, 0);
  const landmarks: Landmark[] = new Array(21);
  landmarks[0] = wrist;

  const bases = [
    { i: 1, dx: sign * 0.22, dy: 0.22, len: 0.55, wiggle: 0.4 },
    { i: 5, dx: sign * 0.12, dy: -0.02, len: 0.95, wiggle: 0.15 },
    { i: 9, dx: sign * 0.02, dy: -0.06, len: 1.0, wiggle: 0 },
    { i: 13, dx: sign * -0.1, dy: -0.02, len: 0.92, wiggle: -0.12 },
    { i: 17, dx: sign * -0.2, dy: 0.08, len: 0.75, wiggle: -0.28 },
  ];

  for (const finger of bases) {
    const angle = finger.wiggle * spread + wave * 0.35 * Math.sin(finger.i);
    const dirX = sign * Math.sin(angle) * 0.15;
    const dirY = -1;
    let x = finger.dx;
    let y = finger.dy;
    for (let j = 0; j < 4; j++) {
      const t = (j + 1) / 4;
      const crumple = curl * t * t * 0.55;
      x += dirX * (finger.len / 4);
      y += dirY * (finger.len / 4) + crumple;
      const z = -t * 0.08 + Math.sin(wave + j) * 0.01;
      landmarks[finger.i + j] = rot(x, y, z);
    }
  }

  return { side, landmarks: landmarks as Landmark[], score: 0.99 };
}

export type DemoPose = "live" | "pinch" | "point" | "open_palm" | "fist" | "peace";

export const DEMO_POSES: DemoPose[] = ["live", "pinch", "point", "open_palm", "fist", "peace"];

function foldFingers(hand: TrackedHand, fingers: readonly FingerName[]): void {
  for (const finger of fingers) {
    const [mcpI, pipI, dipI, tipI] = FINGER_JOINTS[finger];
    const mcp = hand.landmarks[mcpI];
    const pip = hand.landmarks[pipI];
    if (!mcp) continue;
    const toward = pip ?? mcp;
    const fold = (t: number) => ({
      x: mcp.x + (toward.x - mcp.x) * t,
      y: mcp.y + (toward.y - mcp.y) * t,
      z: mcp.z,
    });
    hand.landmarks[pipI] = fold(0.45);
    hand.landmarks[dipI] = fold(0.25);
    hand.landmarks[tipI] = fold(0.12);
  }
}

export function posedHand(side: TrackedHand["side"], pose: DemoPose, palm: { x: number; y: number }): TrackedHand {
  const open = kinematicHand(side, palm, { curl: 0, spread: 1.1, wave: 0, yaw: 0, scale: 0.23 });
  if (pose === "live") return kinematicHand(side, palm);
  if (pose === "open_palm") return open;
  if (pose === "pinch") {
    const h = kinematicHand(side, palm, { curl: 0.4, spread: 0.4, wave: 0, yaw: 0, scale: 0.22 });
    const thumb = h.landmarks[4];
    if (thumb) h.landmarks[8] = { x: thumb.x + 0.003, y: thumb.y + 0.002, z: thumb.z };
    foldFingers(h, ["middle", "ring", "pinky"]);
    return h;
  }
  if (pose === "fist") {
    foldFingers(open, FINGER_NAMES);
    return open;
  }
  if (pose === "peace") {
    foldFingers(open, ["thumb", "ring", "pinky"]);
    return open;
  }
  foldFingers(open, ["thumb", "middle", "ring", "pinky"]);
  return open;
}

export function demoFrame(t: number, pose: DemoPose = "live"): TrackedHand[] {
  const breathe = Math.sin(t * 1.1) * 0.03;
  const orbit = t * 0.35;
  const leftPalm = { x: 0.67 + Math.sin(orbit) * 0.04, y: 0.52 + breathe };
  const rightPalm = { x: 0.33 + Math.cos(orbit * 0.9) * 0.04, y: 0.5 - breathe };

  if (pose === "live") {
    return [
      kinematicHand("Left", leftPalm, {
        spread: 0.85 + Math.sin(t * 1.7) * 0.25,
        curl: 0.08 + Math.max(0, Math.sin(t * 0.9)) * 0.35,
        wave: t * 2.2,
        yaw: -0.18 + Math.sin(t * 0.6) * 0.08,
        scale: 0.24,
      }),
      kinematicHand("Right", rightPalm, {
        spread: 1 + Math.cos(t * 1.4) * 0.2,
        curl: 0.05 + Math.max(0, Math.sin(t * 1.3 + 1)) * 0.5,
        wave: t * 1.8 + 1.2,
        yaw: 0.2 + Math.cos(t * 0.5) * 0.1,
        scale: 0.25,
      }),
    ];
  }

  return [posedHand("Left", pose, leftPalm), posedHand("Right", pose, rightPalm)];
}
