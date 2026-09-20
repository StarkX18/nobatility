import { computeHomography, reprojectionError, type Homography, type Pair } from "./homography";
import type { FingerPointer, Vec2 } from "./types";

export const CAL_TARGETS = [
  { id: "tl", nx: 0.12, ny: 0.16, label: "Top left" },
  { id: "tr", nx: 0.88, ny: 0.16, label: "Top right" },
  { id: "br", nx: 0.88, ny: 0.84, label: "Bottom right" },
  { id: "bl", nx: 0.12, ny: 0.84, label: "Bottom left" },
] as const;

export type TargetId = (typeof CAL_TARGETS)[number]["id"];

export interface CalTargetView {
  id: TargetId;
  nx: number;
  ny: number;
  label: string;
  state: "pending" | "active" | "done";
}

export interface CalibrationView {
  running: boolean;
  step: number;
  total: number;
  dwell: number;
  targets: CalTargetView[];
  message: string;
}

const DWELL_SEC = 0.85;
const STABLE = 0.022;
const HISTORY = 16;

export function primaryIndex(pointers: FingerPointer[]): FingerPointer | null {
  const indexes = pointers.filter((p) => p.finger === "index");
  return indexes.find((p) => p.side === "Right") ?? indexes[0] ?? null;
}

export class CalibrationSession {
  running = false;
  step = 0;
  pairs: Pair[] = [];
  dwell = 0;
  private history: Vec2[] = [];
  lastError: string | null = null;
  result: Homography | null = null;

  get view(): CalibrationView {
    return {
      running: this.running,
      step: this.step,
      total: CAL_TARGETS.length,
      dwell: this.dwell / DWELL_SEC,
      targets: CAL_TARGETS.map((t, i) => ({
        ...t,
        state: !this.running ? "pending" : i < this.step ? "done" : i === this.step ? "active" : "pending",
      })),
      message: this.message(),
    };
  }

  start(): void {
    this.running = true;
    this.step = 0;
    this.pairs = [];
    this.dwell = 0;
    this.history = [];
    this.lastError = null;
    this.result = null;
  }

  cancel(): void {
    this.running = false;
    this.dwell = 0;
    this.history = [];
  }

  /** Feed the live index *aim* (MCP→tip), not the fingertip's pixel. */
  update(index: Vec2 | null, dt: number, pinch: boolean): "idle" | "sampling" | "captured" | "complete" | "failed" {
    if (!this.running) return "idle";
    if (!index) {
      this.dwell = Math.max(0, this.dwell - dt);
      this.history = [];
      return "sampling";
    }

    this.history.push(index);
    if (this.history.length > HISTORY) this.history.shift();
    const stable = this.history.length >= 8 && this.spread() < STABLE;

    if (pinch && stable) return this.capture(index);
    if (!stable) {
      this.dwell = Math.max(0, this.dwell - dt * 1.6);
      return "sampling";
    }

    this.dwell += dt;
    if (this.dwell >= DWELL_SEC) return this.capture(this.mean());
    return "sampling";
  }

  /** Space / click / voice “next” — uses the current mean if we have samples. */
  confirm(index: Vec2 | null): "idle" | "captured" | "complete" | "failed" | "sampling" {
    if (!this.running) return "idle";
    const src = index ?? (this.history.length ? this.mean() : null);
    if (!src) return "sampling";
    return this.capture(src);
  }

  private capture(src: Vec2): "captured" | "complete" | "failed" {
    const target = CAL_TARGETS[this.step];
    if (!target) return "failed";
    this.pairs.push({ src: { ...src }, dst: { x: target.nx, y: target.ny } });
    this.step += 1;
    this.dwell = 0;
    this.history = [];

    if (this.step < CAL_TARGETS.length) return "captured";
    return this.finish();
  }

  private finish(): "complete" | "failed" {
    const H = computeHomography(this.pairs);
    if (!H || reprojectionError(H, this.pairs) > 0.04) {
      this.lastError = "Could not fit those four points. Try again, holding steadier.";
      this.running = false;
      return "failed";
    }
    this.result = H;
    this.running = false;
    return "complete";
  }

  private mean(): Vec2 {
    const n = this.history.length || 1;
    return {
      x: this.history.reduce((s, p) => s + p.x, 0) / n,
      y: this.history.reduce((s, p) => s + p.y, 0) / n,
    };
  }

  private spread(): number {
    const m = this.mean();
    let worst = 0;
    for (const p of this.history) {
      worst = Math.max(worst, Math.hypot(p.x - m.x, p.y - m.y));
    }
    return worst;
  }

  private message(): string {
    if (!this.running) return "";
    const t = CAL_TARGETS[this.step];
    return `Aim your index at ${t?.label ?? "the mark"} and hold (${this.step + 1} of ${CAL_TARGETS.length})`;
  }
}

const STORAGE_KEY = "nobatility.calibration.v2";
const LEGACY_KEY = "nobatility.calibration.v1";

export interface StoredCalibration {
  version: 2;
  kind: "aim";
  pairs: Pair[];
  homography: Homography;
}

export function saveCalibration(data: StoredCalibration, storage: Pick<Storage, "setItem" | "removeItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
  storage.removeItem(LEGACY_KEY);
}

export function loadCalibration(storage: Pick<Storage, "getItem"> = localStorage): StoredCalibration | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCalibration;
    if (parsed.version !== 2 || parsed.kind !== "aim" || !parsed.homography || parsed.pairs?.length < 4) return null;
    const err = reprojectionError(parsed.homography, parsed.pairs);
    if (err > 0.05) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCalibration(storage: Pick<Storage, "removeItem"> = localStorage): void {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(LEGACY_KEY);
}
