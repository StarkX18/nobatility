import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { LandmarkSmoother } from "../smoothing";
import type { TrackedHand } from "../types";
import { withTimeout } from "./loadTimeout";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const GPU_CREATE_MS = 12_000;

type Delegate = "GPU" | "CPU";

export class MediaPipeHands {
  private landmarker: HandLandmarker | null = null;
  private smoother = new LandmarkSmoother();
  private lastVideoTime = -1;

  async load(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    try {
      this.landmarker = await withTimeout(
        this.create(fileset, "GPU"),
        GPU_CREATE_MS,
        "MediaPipe GPU HandLandmarker",
      );
    } catch {
      this.landmarker = await this.create(fileset, "CPU");
    }
  }

  private create(fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, delegate: Delegate) {
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
  }

  reset(): void {
    this.smoother.reset();
    this.lastVideoTime = -1;
  }

  detect(video: HTMLVideoElement, t: number): TrackedHand[] {
    if (!this.landmarker) return [];
    if (video.readyState < 2) return [];
    if (video.currentTime === this.lastVideoTime) return [];
    this.lastVideoTime = video.currentTime;

    let result: ReturnType<HandLandmarker["detectForVideo"]>;
    try {
      result = this.landmarker.detectForVideo(video, t * 1000);
    } catch {
      return [];
    }
    const hands: TrackedHand[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const raw = result.landmarks[i];
      if (!raw) continue;
      const handed = result.handedness[i]?.[0];
      // Selfie cameras are mirrored; MediaPipe labels in image space.
      // After we mirror for display, swap labels so "Right" matches the user's right hand.
      const labelled = handed?.categoryName === "Left" ? "Right" : "Left";
      const side = labelled as TrackedHand["side"];
      const smoothed = this.smoother.smoothHand(
        `${side}-${i}`,
        raw.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        t,
      );
      hands.push({
        side,
        landmarks: smoothed,
        score: handed?.score ?? 0,
      });
    }

    return hands;
  }
}
