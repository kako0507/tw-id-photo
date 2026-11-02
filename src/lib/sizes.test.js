import { describe, it, expect } from "vitest";
import { SIZES, SIZE_BY_ID, DEFAULT_COUNTS } from "./sizes.js";

describe("size table", () => {
  it("every size has its target head inside its range", () => {
    for (const s of SIZES) {
      expect(s.headRange[0]).toBeLessThanOrEqual(s.headMm);
      expect(s.headMm).toBeLessThanOrEqual(s.headRange[1]);
    }
  });
  it("every size positions the head", () => {
    for (const s of SIZES) {
      const n = [s.topMm, s.eyeFromBottomMm].filter((v) => typeof v === "number").length;
      expect(n).toBe(1);
    }
  });
  it("head fits inside the photo", () => {
    for (const s of SIZES) expect((s.topMm ?? 0) + s.headRange[1]).toBeLessThan(s.h);
  });
  it("default counts refer to real sizes", () => {
    for (const id of Object.keys(DEFAULT_COUNTS)) expect(SIZE_BY_ID[id]).toBeDefined();
  });
});
