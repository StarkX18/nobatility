import { describe, expect, it } from "vitest";
import { demoFrame, kinematicHand } from "../src/hands/demoHands";
import { landmarkToScreen } from "../src/mapping";
import { FINGER_NAMES, pointersFromHands, TIP_INDEX } from "../src/types";

describe("hand model", () => {
  it("emits 21 landmarks per kinematic hand", () => {
    const hand = kinematicHand("Right", { x: 0.5, y: 0.5 });
    expect(hand.landmarks).toHaveLength(21);
    expect(hand.landmarks.every((lm) => Number.isFinite(lm.x) && Number.isFinite(lm.y))).toBe(true);
  });

  it("places the left hand on the left after the selfie map", () => {
    const [left] = demoFrame(0);
    expect(left?.side).toBe("Left");
    const palm = left!.landmarks[0]!;
    const screen = landmarkToScreen(palm, 1000, 1000, { mirrorX: true, inset: 0 });
    expect(screen.x).toBeLessThan(500);
  });

  it("exposes ten named fingertip pointers for two hands", () => {
    const pointers = pointersFromHands(demoFrame(0.5));
    expect(pointers).toHaveLength(10);
    const ids = pointers.map((p) => p.id).sort();
    const expected = ["Left", "Right"].flatMap((side) =>
      FINGER_NAMES.map((f) => `${side}-${f}`),
    ).sort();
    expect(ids).toEqual(expected);
  });

  it("marks pinch when thumb and index tips are close", () => {
    const hand = kinematicHand("Left", { x: 0.4, y: 0.5 }, { curl: 1.8, spread: 0.1, scale: 0.08 });
    const thumb = hand.landmarks[TIP_INDEX.thumb]!;
    const index = hand.landmarks[TIP_INDEX.index]!;
    index.x = thumb.x + 0.01;
    index.y = thumb.y + 0.01;
    const pointers = pointersFromHands([hand]);
    expect(pointers.filter((p) => p.pinch).map((p) => p.finger).sort()).toEqual(["index", "thumb"]);
  });
});
