import type { CalibrationView } from "../calibration";
import { landmarkToScreen, type ScreenMap } from "../mapping";
import {
  FINGER_NAMES,
  SKELETON_EDGES,
  type FingerName,
  type FingerPointer,
  type FrameState,
  type HandSide,
} from "../types";

const FINGER_HUE: Record<FingerName, number> = {
  thumb: 32,
  index: 48,
  middle: 55,
  ring: 28,
  pinky: 18,
};

const SIDE_SHIFT: Record<HandSide, number> = {
  Left: 196,
  Right: 0,
};

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export class OverlayRenderer {
  private trails = new Map<string, TrailPoint[]>();
  private appear = new Map<string, number>();

  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(
    state: FrameState,
    map: ScreenMap,
    flags: { skeleton: boolean; trails: boolean },
    calibration?: CalibrationView,
  ): void {
    const { ctx } = this;
    const width = ctx.canvas.clientWidth || ctx.canvas.width;
    const height = ctx.canvas.clientHeight || ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    this.vignette(width, height);

    for (const hand of state.hands) {
      const pts = hand.landmarks.map((lm) => landmarkToScreen(lm, width, height, map));
      if (flags.skeleton) this.drawSkeleton(pts, hand.side);
      this.drawPalm(pts[0], hand.side);
    }

    for (const pointer of state.pointers) {
      const p = landmarkToScreen(pointer, width, height, map);
      if (flags.trails) this.pushTrail(pointer.id, p.x, p.y);
    }

    if (flags.trails) this.drawTrails();

    for (const pointer of state.pointers) {
      const p = landmarkToScreen(pointer, width, height, map);
      this.drawPointer(pointer, p.x, p.y, state.t);
    }

    if (calibration?.running) this.drawCalibration(calibration, width, height, state.t);
  }

  clearTrails(): void {
    this.trails.clear();
    this.appear.clear();
  }

  private drawCalibration(cal: CalibrationView, width: number, height: number, t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(4, 6, 12, 0.28)";
    ctx.fillRect(0, 0, width, height);

    for (const target of cal.targets) {
      const x = target.nx * width;
      const y = target.ny * height;
      const active = target.state === "active";
      const done = target.state === "done";
      const pulse = 1 + 0.08 * Math.sin(t * 6);
      const r = (active ? 34 : 16) * (active ? pulse : 1);

      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = active ? "rgba(255, 200, 120, 0.16)" : "rgba(255,255,255,0.03)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = done ? "rgba(93, 255, 159, 0.9)" : active ? "rgba(255, 210, 140, 0.95)" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.stroke();

      if (active && cal.dwell > 0) {
        ctx.beginPath();
        ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cal.dwell));
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = done ? "#5dff9f" : "#fff8ee";
      ctx.fill();

      ctx.font = "600 13px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.textAlign = "center";
      ctx.fillText(target.label, x, y + r + 22);
    }

    ctx.font = "500 15px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.textAlign = "center";
    ctx.fillText(cal.message, width / 2, height * 0.5);
  }

  private vignette(w: number, h: number): void {
    const g = this.ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, h * 0.85);
    g.addColorStop(0, "rgba(10, 16, 28, 0)");
    g.addColorStop(1, "rgba(4, 6, 12, 0.45)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);
  }

  private color(side: HandSide, finger: FingerName, a = 1): string {
    const hue = (FINGER_HUE[finger] + SIDE_SHIFT[side]) % 360;
    return `hsla(${hue}, 92%, 62%, ${a})`;
  }

  private drawSkeleton(pts: { x: number; y: number }[], side: HandSide): void {
    const ctx = this.ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [a, b] of SKELETON_EDGES) {
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = side === "Left" ? "rgba(120, 220, 255, 0.28)" : "rgba(255, 170, 90, 0.28)";
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = side === "Left" ? "rgba(170, 230, 255, 0.55)" : "rgba(255, 200, 140, 0.55)";
      ctx.fill();
    }
  }

  private drawPalm(p: { x: number; y: number } | undefined, side: HandSide): void {
    if (!p) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = side === "Left" ? "rgba(120, 220, 255, 0.35)" : "rgba(255, 170, 90, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private pushTrail(id: string, x: number, y: number): void {
    let trail = this.trails.get(id);
    if (!trail) {
      trail = [];
      this.trails.set(id, trail);
    }
    trail.push({ x, y, life: 1 });
    if (trail.length > 22) trail.shift();
    for (const pt of trail) pt.life *= 0.88;
  }

  private drawTrails(): void {
    const ctx = this.ctx;
    for (const [id, trail] of this.trails) {
      const [sideName, fingerName] = id.split("-") as [HandSide, FingerName];
      if (!FINGER_NAMES.includes(fingerName)) continue;
      ctx.beginPath();
      trail.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.strokeStyle = this.color(sideName, fingerName, 0.28);
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  }

  private drawPointer(pointer: FingerPointer, x: number, y: number, t: number): void {
    const ctx = this.ctx;
    const born = this.appear.get(pointer.id) ?? t;
    this.appear.set(pointer.id, born);
    const spawn = Math.min(1, (t - born) * 4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + x * 0.01);
    const radius = (pointer.pinch ? 22 : 14 + pulse * 2.5) * (0.35 + 0.65 * spawn);

    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.4);
    glow.addColorStop(0, this.color(pointer.side, pointer.finger, 0.45));
    glow.addColorStop(1, this.color(pointer.side, pointer.finger, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.color(pointer.side, pointer.finger, 0.95);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8ee";
    ctx.fill();

    if (pointer.pinch) {
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = "600 11px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.textAlign = "center";
    const label = `${pointer.side === "Left" ? "L" : "R"} ${pointer.finger}`;
    const slot = FINGER_NAMES.indexOf(pointer.finger);
    ctx.fillText(label, x + (slot - 2) * 10, y + radius + 16);
  }
}
