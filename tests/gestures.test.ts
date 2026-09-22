import { describe, expect, it } from "vitest";
import { posedHand } from "../src/hands/demoHands";
import { classifyHand, extractFeatures, GestureHold } from "../src/gestures/geometry";
import { shouldAskJev } from "../src/gestures/gate";

const palm = { x: 0.4, y: 0.55 };

describe("geometry gestures", () => {
  it("labels a snapped pinch", () => {
    const g = classifyHand(posedHand("Right", "pinch", palm));
    expect(g.name).toBe("pinch");
    expect(g.confidence).toBeGreaterThan(0.35);
  });

  it("labels an open palm vs a fist", () => {
    expect(classifyHand(posedHand("Right", "open_palm", palm)).name).toBe("open_palm");
    expect(classifyHand(posedHand("Right", "fist", palm)).name).toBe("fist");
  });

  it("labels point and peace", () => {
    expect(classifyHand(posedHand("Right", "point", palm)).name).toBe("point");
    expect(classifyHand(posedHand("Right", "peace", palm)).name).toBe("peace");
  });

  it("pinch ratio is small relative to hand size", () => {
    const f = extractFeatures(posedHand("Left", "pinch", { x: 0.6, y: 0.5 }));
    expect(f.pinch).toBeLessThan(0.35);
  });
});

describe("hold + Jev gate", () => {
  it("does not become stable on a single frame", () => {
    const hold = new GestureHold(10);
    const sample = classifyHand(posedHand("Right", "pinch", palm));
    const first = hold.push(sample);
    expect(first.stable).toBe(false);
    let last = first;
    for (let i = 0; i < 12; i++) last = hold.push(sample);
    expect(last.stable).toBe(true);
    expect(last.name).toBe("pinch");
  });

  it("skips Jev on a confident none or a very sure call", () => {
    expect(shouldAskJev({ name: "none", confidence: 1, scores: { none: 1 }, features: null })).toBe(false);
    expect(
      shouldAskJev({ name: "pinch", confidence: 0.92, scores: { pinch: 0.9 }, features: null }),
    ).toBe(false);
    expect(
      shouldAskJev({ name: "point", confidence: 0.5, scores: { point: 0.5, peace: 0.42 }, features: null }),
    ).toBe(true);
  });
});
