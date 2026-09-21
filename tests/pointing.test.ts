import { describe, expect, it } from "vitest";
import { computeHomography } from "../src/homography";
import { kinematicHand } from "../src/hands/demoHands";
import { CORNER_AIMS, setIndexAim } from "../src/hands/guideHands";
import { aimToScreen, projectHand } from "../src/mapping";
import { fingerAim, pointingAim } from "../src/pointing";
import { CAL_TARGETS } from "../src/calibration";

describe("pointingAim", () => {
  it("is unchanged if the bone is scaled or translated (near vs far)", () => {
    const from = { x: 0.2, y: 0.4, z: 0.05 };
    const to = { x: 0.28, y: 0.22, z: -0.12 };
    const base = pointingAim(from, to);
    const scaled = pointingAim(
      { x: from.x, y: from.y, z: from.z * 2 },
      { x: from.x + (to.x - from.x) * 2, y: from.y + (to.y - from.y) * 2, z: to.z * 2 },
    );
    expect(scaled.x).toBeCloseTo(base.x, 5);
    expect(scaled.y).toBeCloseTo(base.y, 5);

    const shifted = pointingAim(
      { x: from.x + 0.3, y: from.y - 0.2, z: from.z },
      { x: to.x + 0.3, y: to.y - 0.2, z: to.z },
    );
    expect(shifted.x).toBeCloseTo(base.x, 5);
    expect(shifted.y).toBeCloseTo(base.y, 5);
  });
});

describe("fitted aim vs distance", () => {
  it("keeps the index pointer put when the demo hand is drawn smaller (farther)", () => {
    const pairs = CORNER_AIMS.map((aim, i) => ({
      src: aim,
      dst: { x: CAL_TARGETS[i]!.nx, y: CAL_TARGETS[i]!.ny },
    }));
    const H = computeHomography(pairs)!;
    const map = { mirrorX: true, inset: 0.16, homography: H };

    const near = setIndexAim(kinematicHand("Right", { x: 0.4, y: 0.5 }, { scale: 0.4 }), CORNER_AIMS[0]!);
    const far = setIndexAim(kinematicHand("Right", { x: 0.55, y: 0.62 }, { scale: 0.12 }), CORNER_AIMS[0]!);

    expect(fingerAim(near, "index")!.x).toBeCloseTo(fingerAim(far, "index")!.x, 3);
    expect(fingerAim(near, "index")!.y).toBeCloseTo(fingerAim(far, "index")!.y, 3);

    const a = projectHand(near, 1000, 800, map)[8]!;
    const b = projectHand(far, 1000, 800, map)[8]!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(4);

    const screen = aimToScreen(CORNER_AIMS[0]!, 1000, 800, map);
    expect(screen.x / 1000).toBeCloseTo(CAL_TARGETS[0]!.nx, 3);
    expect(screen.y / 800).toBeCloseTo(CAL_TARGETS[0]!.ny, 3);
  });
});
