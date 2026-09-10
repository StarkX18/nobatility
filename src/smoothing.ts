/**
 * One Euro Filter — Casiez, Roussel, Vogel (CHI 2012).
 * Same family of smoothing Apple-style pointer systems rely on:
 * low lag at rest, more lag only when the signal is noisy.
 */
function smoothingFactor(te: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / te);
}

function lerp(prev: number, next: number, alpha: number): number {
  return alpha * next + (1 - alpha) * prev;
}

export class OneEuroFilter {
  private xHat = 0;
  private dxHat = 0;
  private initialized = false;
  private lastT = 0;

  constructor(
    private minCutoff = 1.2,
    private beta = 0.007,
    private dCutoff = 1.0,
  ) {}

  reset(): void {
    this.initialized = false;
  }

  filter(x: number, t: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.lastT = t;
      this.xHat = x;
      this.dxHat = 0;
      return x;
    }

    const dt = Math.max(1e-3, t - this.lastT);
    this.lastT = t;

    const dx = (x - this.xHat) / dt;
    const aD = smoothingFactor(dt, this.dCutoff);
    this.dxHat = lerp(this.dxHat, dx, aD);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxHat);
    const a = smoothingFactor(dt, cutoff);
    this.xHat = lerp(this.xHat, x, a);
    return this.xHat;
  }
}

export class LandmarkSmoother {
  private filters = new Map<string, { x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }>();

  constructor(
    private minCutoff = 1.15,
    private beta = 0.012,
  ) {}

  reset(): void {
    this.filters.clear();
  }

  smoothHand(handKey: string, landmarks: { x: number; y: number; z: number }[], t: number) {
    return landmarks.map((lm, i) => {
      const key = `${handKey}:${i}`;
      let f = this.filters.get(key);
      if (!f) {
        f = {
          x: new OneEuroFilter(this.minCutoff, this.beta),
          y: new OneEuroFilter(this.minCutoff, this.beta),
          z: new OneEuroFilter(this.minCutoff, this.beta * 0.4),
        };
        this.filters.set(key, f);
      }
      return {
        x: f.x.filter(lm.x, t),
        y: f.y.filter(lm.y, t),
        z: f.z.filter(lm.z, t),
      };
    });
  }
}
