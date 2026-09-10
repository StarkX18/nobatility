import { describe, expect, it } from "vitest";
import { landmarkToScreen } from "../src/mapping";

describe("landmarkToScreen", () => {
  it("mirrors x so a selfie right hand lands on the right", () => {
    const p = landmarkToScreen({ x: 0.0, y: 0.5 }, 1000, 1000, { mirrorX: true, inset: 0 });
    expect(p.x).toBe(1000);
    expect(p.y).toBe(500);
  });

  it("keeps camera x when mirroring is off", () => {
    const p = landmarkToScreen({ x: 0.0, y: 0.25 }, 100, 100, { mirrorX: false, inset: 0 });
    expect(p.x).toBe(0);
    expect(p.y).toBe(25);
  });

  it("clamps inset remap to the screen edges", () => {
    const p = landmarkToScreen({ x: 0, y: 0 }, 200, 100, { mirrorX: false, inset: 0.1 });
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });
});
