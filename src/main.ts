import {
  CAL_TARGETS,
  CalibrationSession,
  clearCalibration,
  loadCalibration,
  primaryIndex,
  saveCalibration,
} from "./calibration";
import { calibrationGuideHands } from "./hands/guideHands";
import { demoFrame } from "./hands/demoHands";
import { MediaPipeHands } from "./hands/mediapipeTracker";
import { DEFAULT_MAP, screenToLandmark, type ScreenMap } from "./mapping";
import { OverlayRenderer } from "./render/overlay";
import { FINGER_NAMES, pointersFromHands, type FrameState, type TrackedHand } from "./types";
import { parseVoiceCommand, VoiceListener } from "./voice/speech";

const video = document.querySelector<HTMLVideoElement>("#camera")!;
const canvas = document.querySelector<HTMLCanvasElement>("#overlay")!;
const ctx = canvas.getContext("2d")!;
const overlay = new OverlayRenderer(ctx);

const statsFps = document.querySelector("[data-testid='fps']")!;
const statsHands = document.querySelector("[data-testid='hand-count']")!;
const statsSource = document.querySelector("[data-testid='source']")!;
const statsCal = document.querySelector("[data-testid='cal-status']")!;
const hint = document.querySelector("#hint")!;
const legend = document.querySelector("#legend")!;
const voiceText = document.querySelector("#voice-text")!;
const voicePill = document.querySelector("#voice-pill")!;

const btnDemo = document.querySelector("#btn-demo")!;
const btnCamera = document.querySelector("#btn-camera")!;
const btnSkeleton = document.querySelector("#btn-skeleton")!;
const btnTrails = document.querySelector("#btn-trails")!;
const btnMirror = document.querySelector("#btn-mirror")!;
const btnVoice = document.querySelector("#btn-voice")!;
const btnCalibrate = document.querySelector("#btn-calibrate")!;
const btnResetCal = document.querySelector("#btn-reset-cal")!;

const map: ScreenMap = { ...DEFAULT_MAP };
let source: "demo" | "camera" = "demo";
let showSkeleton = true;
let showTrails = true;
let cameraError = "";
let tracker: MediaPipeHands | null = null;
let trackerLoading = false;
let lastHands: TrackedHand[] = [];
let lastTs = performance.now();
let fps = 0;
let savedHomography = map.homography ?? null;
const voice = new VoiceListener();
const session = new CalibrationSession();

const stored = loadCalibration();
if (stored) {
  map.homography = stored.homography;
  savedHomography = stored.homography;
}

function paintLegend(): void {
  legend.innerHTML = `<div style="opacity:.6;margin-bottom:8px">Pointers</div>`;
  for (const side of ["Left", "Right"] as const) {
    for (const finger of FINGER_NAMES) {
      const hue = side === "Left" ? (fingerHue(finger) + 196) % 360 : fingerHue(finger);
      legend.innerHTML += `<div class="legend-row"><span class="swatch" style="background:hsl(${hue} 92% 62%)"></span>${side[0]} ${finger}</div>`;
    }
  }
}

function fingerHue(finger: (typeof FINGER_NAMES)[number]): number {
  return { thumb: 32, index: 48, middle: 55, ring: 28, pinky: 18 }[finger];
}

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

async function startCamera(): Promise<void> {
  cameraError = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    video.classList.add("live");
    if (!tracker) {
      trackerLoading = true;
      tracker = new MediaPipeHands();
      await tracker.load();
      trackerLoading = false;
    } else {
      tracker.reset();
    }
    source = "camera";
    syncButtons();
  } catch (err) {
    cameraError = err instanceof Error ? err.message : "Camera failed";
    source = "demo";
    video.classList.remove("live");
    syncButtons();
    voiceText.textContent = `Camera unavailable — ${cameraError}. Staying in demo.`;
  }
}

function stopCamera(): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  video.classList.remove("live");
  source = "demo";
  lastHands = [];
  syncButtons();
}

function cssSize(): { w: number; h: number } {
  return { w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight };
}

function startCalibration(): void {
  savedHomography = map.homography ?? null;
  map.homography = null;
  session.start();
  overlay.clearTrails();
  syncButtons();
}

function cancelCalibration(): void {
  session.cancel();
  map.homography = savedHomography;
  syncButtons();
}

function onCalEvent(kind: string): void {
  if (kind === "sampling" || kind === "idle") return;
  if (kind === "complete" && session.result) {
    map.homography = session.result;
    savedHomography = session.result;
    saveCalibration({ version: 1, pairs: session.pairs, homography: session.result });
    overlay.clearTrails();
    voiceText.textContent = "Calibrated — your reach now maps to this display.";
  }
  if (kind === "failed") {
    map.homography = savedHomography;
    voiceText.textContent = session.lastError ?? "Calibration failed.";
  }
  syncButtons();
}

function resetCalibration(): void {
  session.cancel();
  map.homography = null;
  savedHomography = null;
  clearCalibration();
  overlay.clearTrails();
  syncButtons();
}

function syncButtons(): void {
  btnDemo.classList.toggle("active", source === "demo");
  btnCamera.classList.toggle("active", source === "camera");
  btnSkeleton.classList.toggle("active", showSkeleton);
  btnTrails.classList.toggle("active", showTrails);
  btnMirror.classList.toggle("active", map.mirrorX);
  btnVoice.classList.toggle("active", voice.status === "listening");
  btnCalibrate.classList.toggle("active", session.running);
  btnCalibrate.textContent = session.running ? "Cancel" : "Calibrate";
  statsSource.textContent = trackerLoading ? "loading model" : source;
  statsCal.textContent = map.homography ? "fitted to display" : "default map";
  document.body.classList.toggle("calibrating", session.running);
}

function applyCommand(cmd: string): void {
  if (cmd === "demo") stopCamera();
  if (cmd === "camera") void startCamera();
  if (cmd === "toggle-skeleton") showSkeleton = !showSkeleton;
  if (cmd === "toggle-trails") showTrails = !showTrails;
  if (cmd === "toggle-mirror") map.mirrorX = !map.mirrorX;
  if (cmd === "calibrate") {
    if (session.running) cancelCalibration();
    else startCalibration();
  }
  if (cmd === "cancel" && session.running) cancelCalibration();
  if (cmd === "next" && session.running) {
    onCalEvent(session.confirm(primaryIndex(pointersFromHands(lastHands))));
  }
  if (cmd === "reset-cal") resetCalibration();
  syncButtons();
}

btnDemo.addEventListener("click", () => stopCamera());
btnCamera.addEventListener("click", () => void startCamera());
btnSkeleton.addEventListener("click", () => {
  showSkeleton = !showSkeleton;
  syncButtons();
});
btnTrails.addEventListener("click", () => {
  showTrails = !showTrails;
  syncButtons();
});
btnMirror.addEventListener("click", () => {
  map.mirrorX = !map.mirrorX;
  syncButtons();
});
btnCalibrate.addEventListener("click", () => {
  if (session.running) cancelCalibration();
  else startCalibration();
});
btnResetCal.addEventListener("click", () => resetCalibration());
btnVoice.addEventListener("click", () => {
  if (voice.status === "listening") {
    voice.stop();
    voicePill.classList.remove("listening");
    voiceText.textContent = "Mic idle · say “calibrate”, “demo”, “camera”";
  } else {
    const status = voice.start((ev) => {
      voiceText.textContent = ev.transcript || "Listening…";
      if (ev.final) {
        const cmd = parseVoiceCommand(ev.transcript);
        if (cmd) applyCommand(cmd);
      }
    });
    voicePill.classList.toggle("listening", status === "listening");
    if (status === "unsupported") {
      voiceText.textContent = "Speech recognition isn’t available in this browser.";
    } else if (status === "denied") {
      voiceText.textContent = "Microphone permission denied.";
    } else {
      voiceText.textContent = "Listening…";
    }
  }
  syncButtons();
});

canvas.addEventListener("click", (ev) => {
  if (!session.running) return;
  const target = CAL_TARGETS[session.step];
  if (!target) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const tx = target.nx * rect.width;
  const ty = target.ny * rect.height;
  if (Math.hypot(x - tx, y - ty) > 64) return;
  onCalEvent(session.confirm(primaryIndex(pointersFromHands(lastHands))));
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && session.running) {
    cancelCalibration();
    return;
  }
  if (e.key === " " && session.running) {
    e.preventDefault();
    onCalEvent(session.confirm(primaryIndex(pointersFromHands(lastHands))));
    return;
  }
  if (e.key === "k") {
    if (session.running) cancelCalibration();
    else startCalibration();
  }
  if (e.key === "d") stopCamera();
  if (e.key === "c") void startCamera();
  if (e.key === "s") {
    showSkeleton = !showSkeleton;
    syncButtons();
  }
  if (e.key === "t") {
    showTrails = !showTrails;
    syncButtons();
  }
  if (e.key === "m") {
    map.mirrorX = !map.mirrorX;
    syncButtons();
  }
});

function tick(now: number): void {
  const t = now / 1000;
  const dt = Math.min(0.05, (now - lastTs) / 1000);
  lastTs = now;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;

  let hands: TrackedHand[] = [];
  if (session.running && source === "demo") {
    const target = CAL_TARGETS[session.step];
    const { w, h } = cssSize();
    const src = target
      ? screenToLandmark({ x: target.nx * w, y: target.ny * h }, w, h, {
          mirrorX: map.mirrorX,
          inset: 0.28,
        })
      : { x: 0.5, y: 0.5 };
    hands = calibrationGuideHands(src);
  } else if (source === "demo") {
    hands = demoFrame(t);
  } else if (tracker && !trackerLoading) {
    const detected = tracker.detect(video, t);
    if (detected.length) lastHands = detected;
    hands = lastHands;
  }

  lastHands = hands;
  const pointers = pointersFromHands(hands);

  if (session.running) {
    const index = primaryIndex(pointers);
    onCalEvent(session.update(index, dt, Boolean(index?.pinch)));
  }

  const state: FrameState = {
    t,
    hands,
    pointers,
    fps,
    source,
  };

  const drawMap: ScreenMap = session.running ? { ...map, homography: null } : map;
  overlay.draw(state, drawMap, { skeleton: showSkeleton, trails: showTrails }, session.view);
  statsFps.textContent = `${Math.round(fps)} fps`;
  statsHands.textContent = `${hands.length} hand${hands.length === 1 ? "" : "s"} · ${state.pointers.length} pointers`;
  hint.classList.toggle("hidden", hands.length > 0 || session.running);

  requestAnimationFrame(tick);
}

resize();
window.addEventListener("resize", resize);
paintLegend();
syncButtons();
requestAnimationFrame(tick);
