// Crop geometry. All coordinates are source-image pixels.
// crop = { cx, cy, pxPerMm, angle }: crop center, scale, and face tilt (radians).
// The crop frame is rotated by angle: right = (cos a, sin a), down = d = (-sin a, cos a).

const down = (a) => ({ x: -Math.sin(a), y: Math.cos(a) });
const dot = (p, q) => p.x * q.x + p.y * q.y;

export function autoCrop({ leftEye, rightEye, headTop, chin, angle }, size) {
  const d = down(angle);
  const headPx = dot({ x: chin.x - headTop.x, y: chin.y - headTop.y }, d);
  const pxPerMm = headPx / size.headMm;
  const eye = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };

  let along;
  if (size.eyeFromBottomMm !== undefined) {
    // Visa: eye line sits eyeFromBottomMm above the bottom edge
    along = (size.eyeFromBottomMm - size.h / 2) * pxPerMm;
  } else {
    // Head top sits topMm below the top edge
    const k = (size.h / 2 - size.topMm) * pxPerMm;
    const p = { x: headTop.x + d.x * k, y: headTop.y + d.y * k };
    along = dot({ x: p.x - eye.x, y: p.y - eye.y }, d);
  }
  return { cx: eye.x + d.x * along, cy: eye.y + d.y * along, pxPerMm, angle };
}

// Largest crop of the size's aspect, centered in the image, no rotation
export function centeredCrop(width, height, size) {
  const pxPerMm = Math.min(width / size.w, height / size.h);
  return { cx: width / 2, cy: height / 2, pxPerMm, angle: 0 };
}

// Corners in order TL, TR, BR, BL
export function cropCorners({ cx, cy, pxPerMm, angle }, size) {
  const r = { x: Math.cos(angle), y: Math.sin(angle) };
  const d = down(angle);
  const hw = (size.w / 2) * pxPerMm;
  const hh = (size.h / 2) * pxPerMm;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({
    x: cx + r.x * hw * sx + d.x * hh * sy,
    y: cy + r.y * hw * sx + d.y * hh * sy,
  }));
}

// True when any crop corner falls outside the image
export function isPadded(crop, size, width, height) {
  const eps = 1e-6;
  return cropCorners(crop, size).some(
    (p) => p.x < -eps || p.y < -eps || p.x > width + eps || p.y > height + eps
  );
}

// Guide bands in mm measured from the top edge of the crop
export function guideBands(size) {
  if (size.eyeFromBottomMm !== undefined) {
    return { eye: [size.h - size.eyeRange[1], size.h - size.eyeRange[0]] };
  }
  return {
    headTop: [Math.max(0, size.topMm - 2), size.topMm + 2],
    chin: [size.topMm + size.headRange[0], size.topMm + size.headRange[1]],
  };
}
