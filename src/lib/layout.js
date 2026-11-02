import { SHEET_MM } from "./sizes.js";

const EPS = 1e-9;

// Shelf-pack pieces (sorted tallest first) onto sheets of the given size; null if a piece cannot fit.
function packRun(pieces, sheetW, sheetH, marginMm, gapMm) {
  const usableW = sheetW - 2 * marginMm;
  const usableH = sheetH - 2 * marginMm;
  const sheets = [];
  let sheet = null;
  let x = 0; // cursor inside the usable area
  let y = 0; // top of the current shelf
  let shelfH = 0;

  const openSheet = () => {
    sheet = { w: sheetW, h: sheetH, items: [] };
    sheets.push(sheet);
    x = 0;
    y = 0;
    shelfH = 0;
  };

  for (const p of pieces) {
    if (p.w > usableW + EPS || p.h > usableH + EPS) return null; // infeasible orientation
    if (!sheet) openSheet();
    // Start a new shelf when the piece does not fit on the current one
    if (sheet.items.length && x + gapMm + p.w > usableW + EPS) {
      y += shelfH + gapMm;
      x = 0;
      shelfH = 0;
    }
    // Start a new sheet when the shelf does not fit vertically
    if (y + p.h > usableH + EPS) openSheet();
    const px = sheet.items.length && x > 0 ? x + gapMm : 0;
    sheet.items.push({ key: p.key, x: marginMm + px, y: marginMm + y, w: p.w, h: p.h });
    x = px + p.w;
    shelfH = Math.max(shelfH, p.h);
  }
  return sheets;
}

// Pack pieces onto 4x6 sheets; orientation is chosen per whole run (fewer sheets wins, landscape on ties).
export function layoutSheets(pieces, { marginMm, gapMm }) {
  if (!pieces.length) return [];
  const sorted = [...pieces].sort((a, b) => b.h - a.h); // stable
  const [long, short] = SHEET_MM;
  const runs = [
    { orientation: "landscape", sheets: packRun(sorted, long, short, marginMm, gapMm) },
    { orientation: "portrait", sheets: packRun(sorted, short, long, marginMm, gapMm) },
  ];
  const feasible = runs.filter((r) => r.sheets);
  if (!feasible.length) throw new Error("照片太大，放不進 4×6 相紙");
  const best = feasible.reduce((a, b) => (b.sheets.length < a.sheets.length ? b : a));
  return best.sheets.map((s) => ({ orientation: best.orientation, ...s }));
}
