// Geometry for the sheet viewer's rulers and hover hit-testing (all values in mm)

// One tick per millimetre from 0 to lengthMm: "cm" every 10 mm, "half" every 5 mm, else "mm"
export function rulerTicks(lengthMm) {
  const ticks = [];
  for (let mm = 0; mm <= Math.floor(lengthMm + 1e-9); mm++) {
    ticks.push({ mm, kind: mm % 10 === 0 ? "cm" : mm % 5 === 0 ? "half" : "mm" });
  }
  return ticks;
}

// The layout item under the point (x, y), or null
export function itemAt(sheet, x, y) {
  return sheet.items.find((it) => x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) || null;
}

// Millimetres shown with at most one decimal ("35", "3.5")
export function formatMm(mm) {
  return String(Math.round(mm * 10) / 10);
}
