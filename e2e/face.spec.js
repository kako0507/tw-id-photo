import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SIZES } from "../src/lib/sizes.js";
import { AI_PHOTOS, SAMPLE, SAMPLE_KEY, measure, waitReady } from "./helpers.js";

// Real MediaPipe model: needs network access to jsDelivr and storage.googleapis.com

test("finds the head top and chin on the sample", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  const m = await measure(page);
  const tol = 13.3; // 1 mm in px
  expect(m.features).not.toBeNull();
  expect(Math.abs(m.features.headTop.y - SAMPLE_KEY.headTopY)).toBeLessThan(tol);
  expect(Math.abs(m.features.chin.y - SAMPLE_KEY.chinY)).toBeLessThan(tol);
});

test("finds the head top and chin on every AI photo", async ({ page }) => {
  expect(AI_PHOTOS.length).toBeGreaterThan(0);
  for (const ph of AI_PHOTOS) {
    await page.goto("/");
    await page.setInputFiles("#file", ph.file);
    await waitReady(page);
    const m = await measure(page);
    const headPx = ph.key.chinY - ph.key.headTopY;
    expect(m.features, ph.name).not.toBeNull();
    expect(Math.abs(m.features.headTop.y - ph.key.headTopY), `${ph.name} head top`).toBeLessThan(0.02 * headPx);
    expect(Math.abs(m.features.chin.y - ph.key.chinY), `${ph.name} chin`).toBeLessThan(0.02 * headPx);
  }
});

test("crops every size within the rules on every AI photo", async ({ page }) => {
  expect(AI_PHOTOS.length).toBeGreaterThan(0);
  for (const ph of AI_PHOTOS) {
    await page.goto("/");
    await page.setInputFiles("#file", ph.file);
    await waitReady(page);
    const m = await measure(page);
    expect(m.features, ph.name).not.toBeNull();
    expect(Object.keys(m.sizes).length, ph.name).toBe(SIZES.length);
    for (const [id, s] of Object.entries(m.sizes)) {
      const tag = `${ph.name} ${id}`;
      const [lo, hi] = s.size.headRange;
      // headMm is a consistency check (pxPerMm comes from the same projection); detection accuracy
      // is asserted against the answer key in "finds the head top and chin on every AI photo"
      expect(s.headMm, `${tag} head mm`).toBeGreaterThanOrEqual(lo);
      expect(s.headMm, `${tag} head mm`).toBeLessThanOrEqual(hi);
      if (s.size.eyeFromBottomMm !== undefined) {
        // guide band is measured from the top edge; the eye line sits h - eyeFromBottom from the top
        const [b0, b1] = s.bands.eye;
        const eyeFromTop = s.size.h - s.eyeFromBottomMm;
        expect(eyeFromTop, `${tag} eye line`).toBeGreaterThanOrEqual(b0);
        expect(eyeFromTop, `${tag} eye line`).toBeLessThanOrEqual(b1);
      } else {
        const [b0, b1] = s.bands.headTop;
        expect(s.topMm, `${tag} head top`).toBeGreaterThanOrEqual(b0);
        expect(s.topMm, `${tag} head top`).toBeLessThanOrEqual(b1);
      }
      expect(s.padded, `${tag} padded`).toBe(false);
    }
  }
});

test("marks the tight sample as padded for the larger sizes", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  const m = await measure(page);
  for (const id of ["1in", "2in-half", "us-visa"]) {
    expect(m.sizes[id].padded, id).toBe(true);
  }
});

test("auto crop keeps the 2-inch head within 32-36 mm on a rotated, enlarged sample", async ({ page }) => {
  await page.goto("/");
  // Unrotated reference: the face angle the detector reports for the plain sample
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  const base = await measure(page);
  const baseAngle = (base.sizes["2in"].angle * 180) / Math.PI;

  await page.reload();
  const src = `data:image/jpeg;base64,${readFileSync(SAMPLE).toString("base64")}`;
  const png = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 1800;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((5 * Math.PI) / 180);
    ctx.scale(2, 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return c.toDataURL("image/png").split(",")[1];
  }, src);
  await page.setInputFiles("#file", { name: "rotated.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await waitReady(page);
  const m = await measure(page);
  const s = m.sizes["2in"];
  const f = m.features;
  // Independent check: the detected head length along the face's down axis, in source px,
  // against the true head height of the sample (510.5 - 30.5 px) times the 2x enlargement.
  // headMm below is only a consistency check, because autoCrop derives pxPerMm from the same projection.
  const d = { x: -Math.sin(s.angle), y: Math.cos(s.angle) };
  const headPx = (f.chin.x - f.headTop.x) * d.x + (f.chin.y - f.headTop.y) * d.y;
  const truePx = (510.5 - 30.5) * 2;
  const tolPx = 2 * 2 * 13.34; // 2 mm at the 2x scale (about 13.34 px/mm in the sample)
  const angleDeg = (s.angle * 180) / Math.PI;
  console.log(`rotated sample: headPx=${headPx.toFixed(1)} (true ${truePx}), unrotated angle=${baseAngle.toFixed(2)}, rotated angle=${angleDeg.toFixed(2)}`);
  expect(Math.abs(headPx - truePx)).toBeLessThanOrEqual(tolPx);
  expect(s.headMm).toBeGreaterThanOrEqual(32);
  expect(s.headMm).toBeLessThanOrEqual(36);
  expect(Math.abs(angleDeg - (baseAngle + 5))).toBeLessThanOrEqual(1);
});

const photosDir = process.env.E2E_PHOTOS_DIR;
test("2-inch head height is within 32-36 mm on every photo in E2E_PHOTOS_DIR", async ({ page }) => {
  test.skip(!photosDir, "E2E_PHOTOS_DIR is not set");
  const files = readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    await page.goto("/");
    await page.setInputFiles("#file", path.join(photosDir, f));
    await waitReady(page);
    const m = await measure(page);
    const mm = m.sizes["2in"].headMm;
    expect(mm, f).toBeGreaterThanOrEqual(32);
    expect(mm, f).toBeLessThanOrEqual(36);
  }
});
