import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "../src/smoothing";

describe("OneEuroFilter", () => {
  it("passes the first sample through", () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.4, 0)).toBe(0.4);
  });

  it("damps high-frequency jitter more than slow motion", () => {
    const noisy = new OneEuroFilter(1.0, 0.007);
    const times = Array.from({ length: 40 }, (_, i) => 0.016 * (i + 1));
    let x = 0.5;
    const jittered: number[] = [];
    times.forEach((t, i) => {
      const sample = 0.5 + (i % 2 === 0 ? 0.08 : -0.08);
      x = noisy.filter(sample, t);
      jittered.push(x);
    });
    const variance =
      jittered.reduce((s, v) => s + (v - 0.5) ** 2, 0) / jittered.length;
    expect(variance).toBeLessThan(0.08 ** 2);

    const ramp = new OneEuroFilter(1.0, 0.05);
    let y = 0;
    for (let i = 0; i < 30; i++) {
      y = ramp.filter(i / 30, 0.016 * (i + 1));
    }
    expect(y).toBeGreaterThan(0.6);
  });
});
