import { demoFrame } from "./hands/demoHands";
import type { MediaPipeHands } from "./hands/mediapipeTracker";
import { DEFAULT_MAP, type ScreenMap } from "./mapping";
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
const voice = new VoiceListener();

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

function releaseCamera(): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  video.classList.remove("live");
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
      syncButtons();
      try {
        const { MediaPipeHands } = await import("./hands/mediapipeTracker");
        const next = new MediaPipeHands();
        await next.load();
        tracker = next;
      } finally {
        trackerLoading = false;
      }
    } else {
      tracker.reset();
    }
    source = "camera";
    lastHands = [];
    syncButtons();
  } catch (err) {
    cameraError = err instanceof Error ? err.message : "Camera failed";
    releaseCamera();
    source = "demo";
    syncButtons();
    voiceText.textContent = `Camera unavailable — ${cameraError}. Staying in demo.`;
  }
}

function stopCamera(): void {
  releaseCamera();
  source = "demo";
  lastHands = [];
  syncButtons();
}

function syncButtons(): void {
  btnDemo.classList.toggle("active", source === "demo");
  btnCamera.classList.toggle("active", source === "camera");
  btnSkeleton.classList.toggle("active", showSkeleton);
  btnTrails.classList.toggle("active", showTrails);
  btnMirror.classList.toggle("active", map.mirrorX);
  btnVoice.classList.toggle("active", voice.status === "listening");
  statsSource.textContent = trackerLoading ? "loading model" : source;
}

function applyCommand(cmd: string): void {
  if (cmd === "demo") stopCamera();
  if (cmd === "camera") void startCamera();
  if (cmd === "toggle-skeleton") showSkeleton = !showSkeleton;
  if (cmd === "toggle-trails") showTrails = !showTrails;
  if (cmd === "toggle-mirror") map.mirrorX = !map.mirrorX;
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
btnVoice.addEventListener("click", () => {
  if (voice.status === "listening") {
    voice.stop();
    voicePill.classList.remove("listening");
    voiceText.textContent = "Mic idle · say “demo”, “camera”, “skeleton”";
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

window.addEventListener("keydown", (e) => {
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
  const dt = now - lastTs;
  lastTs = now;
  if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;

  let hands: TrackedHand[] = [];
  if (source === "demo") {
    hands = demoFrame(t);
  } else if (tracker && !trackerLoading) {
    const detected = tracker.detect(video, t);
    if (detected.length) lastHands = detected;
    hands = lastHands;
  }

  const state: FrameState = {
    t,
    hands,
    pointers: pointersFromHands(hands),
    fps,
    source,
  };

  overlay.draw(state, map, { skeleton: showSkeleton, trails: showTrails });
  statsFps.textContent = `${Math.round(fps)} fps`;
  statsHands.textContent = `${hands.length} hand${hands.length === 1 ? "" : "s"} · ${state.pointers.length} pointers`;
  hint.classList.toggle("hidden", hands.length > 0);

  requestAnimationFrame(tick);
}

resize();
window.addEventListener("resize", resize);
paintLegend();
syncButtons();
requestAnimationFrame(tick);
