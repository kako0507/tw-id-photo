import { describe, it, expect } from "vitest";
import { mmToPx, sheetPixelSize, sheetFileName, canvasToJpeg, drawCutLines } from "./render.js";

// Records the drawing calls a 2D context receives
function fakeCtx() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    save() {}, restore() {}, beginPath() {}, stroke: rec("stroke"),
    moveTo: rec("moveTo"), lineTo: rec("lineTo"), strokeRect: rec("strokeRect"), setLineDash: rec("setLineDash"),
  };
}

describe("render helpers", () => {
  it("converts mm to pixels", () => {
    expect(mmToPx(25.4, 300)).toBe(300);
  });

  it("computes sheet pixel size for both orientations", () => {
    expect(sheetPixelSize({ w: 152.4, h: 101.6 }, 300)).toEqual([1800, 1200]);
    expect(sheetPixelSize({ w: 101.6, h: 152.4 }, 300)).toEqual([1200, 1800]);
  });

  it("names sheet files from 1", () => {
    expect(sheetFileName(0)).toBe("證件照-4x6-1.jpg");
    expect(sheetFileName(2)).toBe("證件照-4x6-3.jpg");
  });

  it("resolves with the blob from toBlob", async () => {
    const blob = {};
    await expect(canvasToJpeg({ toBlob: (cb) => cb(blob) })).resolves.toBe(blob);
  });

  it("rejects when toBlob gives null", async () => {
    await expect(canvasToJpeg({ toBlob: (cb) => cb(null) })).rejects.toThrow("無法產生圖片");
  });

});

describe("drawCutLines", () => {
  it("draws a solid rectangle with no dash", () => {
    const ctx = fakeCtx();
    drawCutLines(ctx, 10, 20, 300, 400, "solid", 300);
    expect(ctx.calls).toEqual([["setLineDash", []], ["strokeRect", 10, 20, 300, 400]]);
  });

  it("draws a dashed rectangle with 1.5 mm dashes and 1 mm gaps", () => {
    const ctx = fakeCtx();
    drawCutLines(ctx, 0, 0, 30, 40, "dashed", 25.4); // 1 px per mm
    const [[, dash], rect] = ctx.calls;
    expect(dash[0]).toBeCloseTo(1.5);
    expect(dash[1]).toBeCloseTo(1);
    expect(rect).toEqual(["strokeRect", 0, 0, 30, 40]);
  });

  it("draws only 3 mm L-marks at the four corners", () => {
    const ctx = fakeCtx();
    drawCutLines(ctx, 0, 0, 30, 40, "corners", 25.4); // 1 px per mm, 3 mm arms
    expect(ctx.calls.filter(([n]) => n === "strokeRect")).toHaveLength(0);
    const moves = ctx.calls.filter(([n]) => n === "moveTo").map(([, x, y]) => [x, y]);
    expect(moves).toEqual([[3, 0], [27, 0], [3, 40], [27, 40]]);
    const corners = ctx.calls.filter(([n]) => n === "lineTo").map(([, x, y]) => [x, y]);
    expect(corners).toEqual([[0, 0], [0, 3], [30, 0], [30, 3], [0, 40], [0, 37], [30, 40], [30, 37]]);
  });
});
