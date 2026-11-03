import { describe, expect, it } from "vitest";
import { formatMm, itemAt, rulerTicks } from "./ruler.js";

describe("rulerTicks", () => {
  it("has one tick per mm, with cm and half-cm marks", () => {
    const ticks = rulerTicks(152.4);
    expect(ticks).toHaveLength(153);
    expect(ticks[0]).toEqual({ mm: 0, kind: "cm" });
    expect(ticks[5]).toEqual({ mm: 5, kind: "half" });
    expect(ticks[7]).toEqual({ mm: 7, kind: "mm" });
    expect(ticks[150]).toEqual({ mm: 150, kind: "cm" });
    expect(ticks.at(-1).mm).toBe(152);
  });

  it("includes the end when the length is a whole number", () => {
    expect(rulerTicks(10).at(-1)).toEqual({ mm: 10, kind: "cm" });
  });
});

describe("itemAt", () => {
  const a = { key: "a", x: 3, y: 3, w: 35, h: 45 };
  const b = { key: "b", x: 40, y: 3, w: 35, h: 45 };
  const sheet = { items: [a, b] };

  it("finds the photo under the point, edges included", () => {
    expect(itemAt(sheet, 20, 20)).toBe(a);
    expect(itemAt(sheet, 40, 48)).toBe(b);
  });

  it("returns null in the gaps and margins", () => {
    expect(itemAt(sheet, 39, 20)).toBeNull();
    expect(itemAt(sheet, 1, 1)).toBeNull();
  });
});

describe("formatMm", () => {
  it("keeps at most one decimal", () => {
    expect(formatMm(35)).toBe("35");
    expect(formatMm(3.04)).toBe("3");
    expect(formatMm(42.25)).toBe("42.3");
  });
});
