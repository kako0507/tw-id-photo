import { describe, it, expect } from "vitest";
import { autoCrop, centeredCrop, cropCorners, isPadded, guideBands } from "./crop.js";
import { SIZES, SIZE_BY_ID } from "./sizes.js";

const upright = {
  leftEye: { x: 440, y: 300 },
  rightEye: { x: 560, y: 300 },
  headTop: { x: 500, y: 100 },
  chin: { x: 500, y: 580 },
  angle: 0,
};

// Rotate every feature point by `rad` about (cx, cy); angle follows the eye line.
function rotateFace(f, rad, cx, cy) {
  const rot = (p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
  };
  const leftEye = rot(f.leftEye);
  const rightEye = rot(f.rightEye);
  return {
    leftEye,
    rightEye,
    headTop: rot(f.headTop),
    chin: rot(f.chin),
    angle: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
  };
}

const nonVisa = SIZES.filter((s) => s.topMm !== undefined);

describe("autoCrop", () => {
  it("scales the head to the target height", () => {
    for (const size of nonVisa) {
      const crop = autoCrop(upright, size);
      expect(Math.abs(480 / crop.pxPerMm - size.headMm)).toBeLessThan(0.01);
    }
  });

  it("puts the head top topMm below the top edge", () => {
    for (const size of nonVisa) {
      const crop = autoCrop(upright, size);
      expect(cropCorners(crop, size)[0].y).toBeCloseTo(100 - size.topMm * crop.pxPerMm, 0);
    }
  });

  it("centers on the eyes", () => {
    for (const size of SIZES) expect(autoCrop(upright, size).cx).toBeCloseTo(500, 5);
  });

  it("puts the US visa eye line 31.5 mm above the bottom edge", () => {
    const size = SIZE_BY_ID["us-visa"];
    const crop = autoCrop(upright, size);
    const [, , br, bl] = cropCorners(crop, size);
    const bottomY = (br.y + bl.y) / 2;
    expect((bottomY - 300) / crop.pxPerMm).toBeCloseTo(31.5, 3);
  });

  it("follows a tilted face", () => {
    const rad = (10 * Math.PI) / 180;
    const face = rotateFace(upright, rad, 500, 300);
    for (const size of nonVisa) {
      const crop = autoCrop(face, size);
      expect(crop.angle).toBeCloseTo(rad, 5);
      expect(Math.abs(480 / crop.pxPerMm - size.headMm)).toBeLessThan(0.01);
      // Head top sits topMm below the top edge, measured along the tilted down axis
      const d = { x: -Math.sin(crop.angle), y: Math.cos(crop.angle) };
      const tl = cropCorners(crop, size)[0];
      const topMm = ((face.headTop.x - tl.x) * d.x + (face.headTop.y - tl.y) * d.y) / crop.pxPerMm;
      expect(topMm).toBeCloseTo(size.topMm, 1);
    }
  });

  it("reports padding", () => {
    const size = SIZE_BY_ID["2in"];
    const high = {
      ...upright,
      leftEye: { x: 440, y: 205 },
      rightEye: { x: 560, y: 205 },
      headTop: { x: 500, y: 5 },
      chin: { x: 500, y: 485 },
    };
    expect(isPadded(autoCrop(high, size), size, 1000, 1000)).toBe(true);
    expect(isPadded(autoCrop(upright, size), size, 1000, 1000)).toBe(false);
  });
});

describe("centeredCrop", () => {
  it("fills the image height or width", () => {
    const size = SIZE_BY_ID["2in"];
    const crop = centeredCrop(1000, 2000, size);
    expect(crop.angle).toBe(0);
    expect(crop.cx).toBe(500);
    expect(crop.cy).toBe(1000);
    expect(size.w * crop.pxPerMm).toBeCloseTo(1000, 5);
    expect(isPadded(crop, size, 1000, 2000)).toBe(false);
    const wide = centeredCrop(2000, 1000, size);
    expect(size.h * wide.pxPerMm).toBeCloseTo(1000, 5);
  });
});

describe("guideBands", () => {
  it("returns head top and chin bands for 2in", () => {
    const g = guideBands(SIZE_BY_ID["2in"]);
    expect(g.headTop).toEqual([2, 6]);
    expect(g.chin).toEqual([36, 40]);
  });

  it("returns only an eye band for us-visa", () => {
    const g = guideBands(SIZE_BY_ID["us-visa"]);
    expect(g.eye).toEqual([15, 22]);
    expect(g.chin).toBeUndefined();
    expect(g.headTop).toBeUndefined();
  });
});
