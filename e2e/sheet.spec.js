import { test, expect } from "@playwright/test";
import { SAMPLE, waitReady } from "./helpers.js";

// No network model: detection is replaced by a fixed stub scaled to the image
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__faceStub = (img) => {
      const w = img.width, h = img.height;
      return {
        leftEye: { x: 0.4 * w, y: 0.45 * h },
        rightEye: { x: 0.6 * w, y: 0.45 * h },
        forehead: { x: 0.5 * w, y: 0.3 * h },
        chin: { x: 0.5 * w, y: 0.7 * h },
        angle: 0,
      };
    };
  });
});

test("exports two 4x6 sheets for eight 1-inch photos", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  await page.getByLabel("1 吋 張數").fill("8");
  await expect(page.getByText("2 張 4×6")).toBeVisible();

  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "全部下載" }).click();
  await expect.poll(() => downloads.length).toBe(2);
  expect(downloads.map((d) => d.suggestedFilename()).sort()).toEqual(["證件照-4x6-1.jpg", "證件照-4x6-2.jpg"]);

  for (const d of downloads) {
    const buf = await (await import("node:fs/promises")).readFile(await d.path());
    const r = await page.evaluate(async (b64) => {
      const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
      // First item center: layout starts at the margin (3 mm); 2in items come first in SIZES order
      // but only 1in has copies here, so the first item is a 1in piece (28x35 mm) at the margin.
      const mm = 300 / 25.4;
      return {
        w: bmp.width, h: bmp.height,
        center: px(Math.round((3 + 14) * mm), Math.round((3 + 17.5) * mm)),
        margin: px(Math.round(1 * mm), Math.round(1 * mm)),
      };
    }, buf.toString("base64"));
    expect([`${r.w}x${r.h}`]).toEqual([expect.stringMatching(/^(1800x1200|1200x1800)$/)]);
    expect(r.margin.every((v) => v >= 250)).toBe(true);
    expect(r.center.every((v) => v >= 250)).toBe(false);
  }
});
