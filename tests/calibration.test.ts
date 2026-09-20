import { describe, expect, it } from "vitest";
import {
  CalibrationSession,
  CAL_TARGETS,
  clearCalibration,
  loadCalibration,
  primaryIndex,
  saveCalibration,
} from "../src/calibration";
import { computeHomography } from "../src/homography";
import { handWithIndexAt } from "../src/hands/guideHands";
import { pointersFromHands, TIP_INDEX } from "../src/types";

describe("CalibrationSession", () => {
  it("fits a homography after four stable samples", () => {
    const session = new CalibrationSession();
    session.start();
    const srcs = [
      { x: 0.22, y: 0.2 },
      { x: 0.71, y: 0.19 },
      { x: 0.74, y: 0.77 },
      { x: 0.2, y: 0.73 },
    ];
    let last: string = "idle";
    for (const src of srcs) {
      last = session.confirm(src);
    }
    expect(last).toBe("complete");
    expect(session.result).not.toBeNull();
    expect(session.running).toBe(false);
  });

  it("dwell-captures when the index stays still", () => {
    const session = new CalibrationSession();
    session.start();
    const src = { x: 0.4, y: 0.3 };
    let status = "sampling";
    for (let i = 0; i < 40 && status === "sampling"; i++) {
      status = session.update(src, 0.05, false);
    }
    expect(status).toBe("captured");
    expect(session.step).toBe(1);
  });
});

describe("calibration storage", () => {
  it("round-trips through a Storage stand-in", () => {
    const bag = new Map<string, string>();
    const storage = {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => void bag.set(k, v),
      removeItem: (k: string) => void bag.delete(k),
    };
    const pairs = [
      { src: { x: 0.25, y: 0.22 }, dst: { x: CAL_TARGETS[0]!.nx, y: CAL_TARGETS[0]!.ny } },
      { src: { x: 0.74, y: 0.21 }, dst: { x: CAL_TARGETS[1]!.nx, y: CAL_TARGETS[1]!.ny } },
      { src: { x: 0.78, y: 0.8 }, dst: { x: CAL_TARGETS[2]!.nx, y: CAL_TARGETS[2]!.ny } },
      { src: { x: 0.22, y: 0.77 }, dst: { x: CAL_TARGETS[3]!.nx, y: CAL_TARGETS[3]!.ny } },
    ];
    const H = computeHomography(pairs)!;
    saveCalibration({ version: 1, pairs, homography: H }, storage);
    const loaded = loadCalibration(storage);
    expect(loaded?.homography[0]).toBeCloseTo(H[0], 8);
    clearCalibration(storage);
    expect(loadCalibration(storage)).toBeNull();
  });
});

describe("guide index", () => {
  it("places the index tip on the requested camera point", () => {
    const tip = { x: 0.41, y: 0.27 };
    const hand = handWithIndexAt("Right", tip);
    const lm = hand.landmarks[TIP_INDEX.index]!;
    expect(lm.x).toBeCloseTo(tip.x, 5);
    expect(lm.y).toBeCloseTo(tip.y, 5);
    expect(primaryIndex(pointersFromHands([hand]))?.finger).toBe("index");
  });
});
