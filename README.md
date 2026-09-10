# Nobatility

Far-field **finger + voice** overlay for a Mac. This MVP is not a single cursor. It draws **up to ten fingertip pointers** (five per hand), skeletons, motion trails, and a voice layer you can grow into real control later.

Apple Head Pointer feels great because of three unglamorous pieces: a stable tracker, a calibration map from sensor space to screen space, and a lag-vs-jitter filter. This project copies that shape for hands.

## What you get today

- **Demo mode** — two kinematic hands, all 10 named pointers, no camera required
- **Camera mode** — MediaPipe Hand Landmarker, 21 points per hand, two hands
- **Overlay** — per-finger color, labels (`L index`, `R thumb`…), trails, pinch rings
- **Voice** — Web Speech API; say “demo”, “camera”, “skeleton”, “trails”, “mirror”
- **Smoothing** — One Euro filter on live landmarks (same family of filter Head Pointer-style pointers use)

Controlling Finder, clicking, dragging, and accessibility APIs are **explicitly out of this MVP**. The overlay is the foundation.

## Run it on your Mac

Needs a current Chrome or Edge build (MediaPipe WASM + WebGPU/WebGL). Safari can run **demo** today; live hands need a Chromium browser until Apple ships the same WASM path cleanly.

```bash
npm install
npm test
npm run dev
```

Open the printed localhost URL, fullscreen the tab (`Control-Command-F`), stand back, hit **Camera**, allow the webcam.

| Key | Action |
| --- | --- |
| `d` | Demo |
| `c` | Camera |
| `s` | Skeleton |
| `t` | Trails |
| `m` | Mirror |

Everything runs **on device**. The camera never leaves the machine; MediaPipe runs in the page.

## How this compares to Head Pointer

| Head Pointer | This MVP |
| --- | --- |
| Face / head pose | Hands, 21 landmarks each |
| One pointer | Ten fingertip pointers |
| System-wide accessibility cursor | In-page overlay (no event injection yet) |
| Calibration rectangle | Mirror + inset reach map (replace with a 4-point calibration next) |
| Heavy smoothing | One Euro on each landmark |

## What it would take to actually drive the Mac

1. **Native overlay** — `NSPanel` / `NSWindow` with `collectionBehavior` `.canJoinAllSpaces`, `.fullScreenAuxiliary`, `ignoresMouseEvents = true`, above all spaces.
2. **Vision** — `VNDetectHumanHandPoseRequest` (same 21-point graph) instead of the browser model, or keep MediaPipe in a small helper process.
3. **Calibration** — hold an index finger on four on-screen targets; solve an affine or homography from camera to display. This is the Head Pointer trick.
4. **Control policy** — do **not** map every fingertip to a mouse. Pick one (usually dominant index), use pinch as click, two-index distance as zoom, and keep the other eight as visual only / gestures.
5. **Voice** — `SFSpeechRecognizer` or the same Web Speech loop, then map phrases onto Accessibility / AppleScript / `CGEvent`.
6. **Permissions** — Camera, Microphone, Accessibility (for posting clicks). TCC prompts are the real installer.

Until those exist, treat this as the **animation and tracking stage**.

## Repo layout

```
src/hands/     demo + MediaPipe tracker
src/render/    canvas overlay
src/voice/     speech + command parse
src/smoothing.ts
src/mapping.ts
```
