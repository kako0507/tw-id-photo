import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE = path.join(here, "fixtures", "sample-2in.jpg");
export const SAMPLE_KEY = JSON.parse(readFileSync(path.join(here, "fixtures", "sample-2in.json"), "utf8"));
const AI_DIR = path.join(here, "fixtures", "ai");

// Every AI photo with its answer key
export const AI_PHOTOS = readdirSync(AI_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    name: f.replace(/\.json$/, ""),
    file: path.join(AI_DIR, f.replace(/\.json$/, ".jpg")),
    key: JSON.parse(readFileSync(path.join(AI_DIR, f), "utf8")),
  }));

// Wait until the first photo is ready (detection done)
export async function waitReady(page) {
  await page.waitForFunction(
    () => Object.values(window.__store.getState().photos.entities).some((p) => p.status === "ready"),
    null,
    { timeout: 120_000 },
  );
}

// Measurements for the first photo, computed in the page from the store
export function measure(page) {
  return page.evaluate(async () => {
    const { SIZES } = await import("/src/lib/sizes.js");
    const { cropCorners, guideBands, isPadded } = await import("/src/lib/crop.js");
    const p = Object.values(window.__store.getState().photos.entities)[0];
    const f = p.features;
    const out = { width: p.width, height: p.height, features: f, sizes: {} };
    if (!f) return out;
    const dot = (a, b) => a.x * b.x + a.y * b.y;
    for (const size of SIZES) {
      const crop = p.crops[size.id];
      const d = { x: -Math.sin(crop.angle), y: Math.cos(crop.angle) };
      const headMm = dot({ x: f.chin.x - f.headTop.x, y: f.chin.y - f.headTop.y }, d) / crop.pxPerMm;
      const tl = cropCorners(crop, size)[0];
      const topMm = dot({ x: f.headTop.x - tl.x, y: f.headTop.y - tl.y }, d) / crop.pxPerMm;
      const eye = { x: (f.leftEye.x + f.rightEye.x) / 2, y: (f.leftEye.y + f.rightEye.y) / 2 };
      const eyeFromBottomMm = size.h - dot({ x: eye.x - tl.x, y: eye.y - tl.y }, d) / crop.pxPerMm;
      out.sizes[size.id] = {
        headMm, topMm, eyeFromBottomMm, angle: crop.angle,
        bands: guideBands(size), size, padded: isPadded(crop, size, p.width, p.height),
      };
    }
    return out;
  });
}
