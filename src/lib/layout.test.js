import { describe, it, expect } from "vitest";
import { layoutSheets } from "./layout.js";

const opts = { marginMm: 3, gapMm: 2 };
const make = (n, w, h, tag) => Array.from({ length: n }, (_, i) => ({ key: `${tag}${i}`, w, h }));

describe("layoutSheets", () => {
  it("fits eight 2-inch photos on one landscape sheet", () => {
    const sheets = layoutSheets(make(8, 35, 45, "a"), opts);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].orientation).toBe("landscape");
  });

  it("fits twelve 1-inch photos on one portrait sheet", () => {
    const sheets = layoutSheets(make(12, 28, 35, "b"), opts);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].orientation).toBe("portrait");
  });

  it("fits four 2-inch and four 1-inch on one sheet", () => {
    const sheets = layoutSheets([...make(4, 35, 45, "a"), ...make(4, 28, 35, "b")], opts);
    expect(sheets).toHaveLength(1);
  });

  it("starts a new sheet when full", () => {
    const sheets = layoutSheets(make(9, 35, 45, "a"), opts);
    expect(sheets.map((s) => s.items.length)).toEqual([8, 1]);
  });

  it("keeps every item inside the margins and apart", () => {
    const pieces = [
      ...make(5, 35, 45, "a"),
      ...make(5, 28, 35, "b"),
      ...make(5, 42, 47, "c"),
      ...make(5, 33, 43, "d"),
    ];
    const sheets = layoutSheets(pieces, opts);
    const eps = 1e-9;
    const m = opts.marginMm;
    const half = opts.gapMm / 2;
    let count = 0;
    for (const s of sheets) {
      for (const it of s.items) {
        count++;
        expect(it.x).toBeGreaterThanOrEqual(m - eps);
        expect(it.y).toBeGreaterThanOrEqual(m - eps);
        expect(it.x + it.w).toBeLessThanOrEqual(s.w - m + eps);
        expect(it.y + it.h).toBeLessThanOrEqual(s.h - m + eps);
      }
      for (let i = 0; i < s.items.length; i++) {
        for (let j = i + 1; j < s.items.length; j++) {
          const a = s.items[i];
          const b = s.items[j];
          const overlapX = a.x - half < b.x + b.w + half - eps && b.x - half < a.x + a.w + half - eps;
          const overlapY = a.y - half < b.y + b.h + half - eps && b.y - half < a.y + a.h + half - eps;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    }
    expect(count).toBe(20);
  });

  it("returns no sheets for no pieces", () => {
    expect(layoutSheets([], opts)).toEqual([]);
  });

  it("uses portrait when a piece only fits portrait", () => {
    const sheets = layoutSheets([{ key: "t", w: 90, h: 140 }], opts);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].orientation).toBe("portrait");
  });

  it("reports sheet size per orientation and keeps item data", () => {
    const [l] = layoutSheets(make(8, 35, 45, "a"), opts);
    expect([l.w, l.h]).toEqual([152.4, 101.6]);
    const [p] = layoutSheets(make(12, 28, 35, "b"), opts);
    expect([p.w, p.h]).toEqual([101.6, 152.4]);
    expect(p.items.map((i) => i.key).sort()).toEqual(make(12, 28, 35, "b").map((i) => i.key).sort());
    expect(p.items.every((i) => i.w === 28 && i.h === 35)).toBe(true);
  });

  it("rejects a piece larger than the sheet", () => {
    expect(() => layoutSheets([{ key: "x", w: 200, h: 200 }], opts)).toThrow("照片太大，放不進 4×6 相紙");
  });
});
