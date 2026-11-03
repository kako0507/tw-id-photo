import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
    const buf = await readFile(await d.path());
    const i = downloads.indexOf(d);
    // First item of this sheet, from the store (default counts: 2in x4 first, then 1in x8)
    const first = await page.evaluate(async (idx) => {
      const { selectSheets } = await import("/src/store/selectors.js");
      const it = selectSheets(window.__store.getState())[idx].items[0];
      return { key: it.key, x: it.x, y: it.y, w: it.w, h: it.h };
    }, i);
    if (i === 0) expect(first.key).toContain(":2in:");
    const r = await page.evaluate(async ({ b64, first }) => {
      const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
      const mm = 300 / 25.4;
      return {
        w: bmp.width, h: bmp.height,
        center: px(Math.round((first.x + first.w / 2) * mm), Math.round((first.y + first.h / 2) * mm)),
        margin: px(Math.round(1 * mm), Math.round(1 * mm)),
      };
    }, { b64: buf.toString("base64"), first });
    expect(`${r.w}x${r.h}`).toMatch(/^(1800x1200|1200x1800)$/);
    expect(r.margin.every((v) => v >= 250)).toBe(true);
    expect(r.center.every((v) => v >= 250)).toBe(false);
  }
});

test("each size row shows its crop and opens the editor; cut style can be picked", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  await expect(page.locator(".size-thumb canvas")).toHaveCount(4);
  await page.getByRole("button", { name: "調整1 吋裁切" }).click();
  await expect(page.getByText("調整裁切（1 吋）")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByLabel("四個角").check();
  expect(await page.evaluate(() => window.__store.getState().settings.cutStyle)).toBe("corners");
  await page.getByLabel("裁切線", { exact: true }).uncheck();
  await expect(page.getByLabel("四個角")).toHaveCount(0);
});

test("clicking a sheet opens it with rulers; hovering a photo shows its size", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", SAMPLE);
  await waitReady(page);
  await page.getByRole("button", { name: /放大檢視第 1 張/ }).click();
  const viewer = page.locator("dialog.viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".tick-label")).toHaveCount(15 + 10); // 1-15 cm across, 1-10 cm down

  // Hover the first photo (2-inch, top left of the sheet)
  const first = await page.evaluate(async () => {
    const { selectSheets } = await import("/src/store/selectors.js");
    return selectSheets(window.__store.getState())[0].items[0];
  });
  const svg = await viewer.locator("svg").boundingBox();
  const vb = await viewer.locator("svg").evaluate((el) => { const b = el.viewBox.baseVal; return { x: b.x, y: b.y, width: b.width }; });
  const k = svg.width / vb.width;
  await page.mouse.move(svg.x + (first.x + first.w / 2 - vb.x) * k, svg.y + (first.y + first.h / 2 - vb.y) * k);
  await expect(viewer.locator(".measure line")).toHaveCount(4);
  await expect(viewer.getByText("35 × 45 mm")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  expect(await page.evaluate(() => window.__store.getState().viewer.sheetIndex)).toBeNull();
});
