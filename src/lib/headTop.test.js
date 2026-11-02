import { describe, it, expect } from "vitest";
import { findHeadTop } from "./headTop.js";

const W = 600;
const H = 500;

// Plain background plus a filled ellipse "head" centred at (cx, cy).
function makeImage({ bg, hair, cx, cy, rx, ry }) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      const c = inside ? hair : bg;
      const i = (y * W + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const head = { cx: 300, cy: 300, rx: 90, ry: 180 }; // top at y = 120
const forehead = { x: 300, y: 250, halfWidth: 60 };

describe("findHeadTop", () => {
  it("finds the top of a dark head on a white background", () => {
    const img = makeImage({ bg: [255, 255, 255], hair: [30, 30, 30], ...head });
    const r = findHeadTop(img, forehead, 10);
    expect(r.found).toBe(true);
    expect(Math.abs(r.y - 120)).toBeLessThanOrEqual(1);
  });

  it("works on a light grey background", () => {
    const img = makeImage({ bg: [200, 200, 200], hair: [60, 40, 30], ...head });
    const r = findHeadTop(img, forehead, 10);
    expect(r.found).toBe(true);
    expect(Math.abs(r.y - 120)).toBeLessThanOrEqual(1);
  });

  it("ignores a thin dark line beside the head", () => {
    const img = makeImage({ bg: [255, 255, 255], hair: [30, 30, 30], ...head });
    // 1 px guide line at y = 60 from head right edge + 40 to the image edge
    for (let x = head.cx + head.rx + 40; x < W; x++) {
      const i = (60 * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
    }
    const r = findHeadTop(img, forehead, 10);
    expect(r.found).toBe(true);
    expect(Math.abs(r.y - 120)).toBeLessThanOrEqual(1);
  });

  it("falls back when the head reaches the top", () => {
    const img = makeImage({ bg: [255, 255, 255], hair: [30, 30, 30], cx: 300, cy: 160, rx: 90, ry: 180 });
    const r = findHeadTop(img, { x: 300, y: 100, halfWidth: 60 }, 33);
    expect(r).toEqual({ y: 33, found: false });
  });

  it("returns a negative fallback unchanged when the crown is cut off", () => {
    const img = makeImage({ bg: [255, 255, 255], hair: [30, 30, 30], cx: 300, cy: 160, rx: 90, ry: 180 });
    const r = findHeadTop(img, { x: 300, y: 100, halfWidth: 60 }, -25);
    expect(r).toEqual({ y: -25, found: false });
  });
});
