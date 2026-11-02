import { describe, it, expect } from "vitest";
import { featuresFromLandmarks } from "./face.js";

// A full 478-point mesh at the origin, with the given indices overridden.
function mesh(points) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  for (const [i, p] of Object.entries(points)) lm[i] = { x: p[0], y: p[1] };
  return lm;
}

describe("featuresFromLandmarks", () => {
  it("maps normalized landmarks to pixels", () => {
    const f = featuresFromLandmarks(mesh({ 10: [0.5, 0.1] }), 1000, 800);
    expect(f.forehead).toEqual({ x: 500, y: 80 });
  });

  it("orders eyes left to right", () => {
    const f = featuresFromLandmarks(mesh({ 468: [0.6, 0.5], 473: [0.4, 0.5] }), 1000, 1000);
    expect(f.leftEye.x).toBeLessThan(f.rightEye.x);
  });

  it("computes the eye-line angle", () => {
    const f = featuresFromLandmarks(mesh({ 468: [0.4, 0.5], 473: [0.6, 0.52] }), 1000, 1000);
    expect(f.angle).toBeCloseTo(Math.atan2(20, 200), 10);
  });

  it("scales features back to the source", () => {
    const f = featuresFromLandmarks(mesh({ 152: [0.5, 0.9] }), 1000, 800, 0.5);
    expect(f.chin).toEqual({ x: 1000, y: 1440 });
  });
});
