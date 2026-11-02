// Face landmarks via MediaPipe Face Landmarker, run locally in the browser.
// The package's "exports" hides its package.json, so read the installed
// version by relative path; the wasm URL then always matches npm.
import visionPkg from "../../node_modules/@mediapipe/tasks-vision/package.json";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionPkg.version}/wasm`;
const MAX_SIDE = 1280;

// Mesh indices: iris centers (image-left, image-right), forehead top, chin.
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const FOREHEAD = 10;
const CHIN = 152;

// Normalized landmarks -> source-image pixels. `scale` is the downscale ratio
// used for detection, so dividing by it maps back to the source.
export function featuresFromLandmarks(landmarks, width, height, scale = 1) {
  const pt = (i) => ({
    x: (landmarks[i].x * width) / scale,
    y: (landmarks[i].y * height) / scale,
  });
  // Order by x so `leftEye` is always the one on the image's left.
  const [leftEye, rightEye] = [pt(LEFT_IRIS), pt(RIGHT_IRIS)].sort((a, b) => a.x - b.x);
  return {
    leftEye,
    rightEye,
    forehead: pt(FOREHEAD),
    chin: pt(CHIN),
    angle: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
  };
}

let landmarkerPromise = null;

// Memoized loader; a failed load is forgotten so a later call can retry.
export function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

// Returns pixel features in source coordinates, or null when no face is found.
export async function detectFace(source) {
  // Dev-only hook so e2e tests can skip the network model.
  if (import.meta.env?.DEV && typeof window !== "undefined" && typeof window.__faceStub === "function") {
    return window.__faceStub(source);
  }
  const landmarker = await loadFaceLandmarker();
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(source, 0, 0, w, h);
  const result = landmarker.detect(canvas);
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) return null;
  return featuresFromLandmarks(landmarks, w, h, scale);
}
