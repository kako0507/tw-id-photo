import { describe, it, expect } from "vitest";
import { mmToPx, sheetPixelSize, sheetFileName } from "./render.js";

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
});
