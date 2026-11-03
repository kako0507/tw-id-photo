// Draws crops onto 4x6 sheets at print resolution

export function mmToPx(mm, dpi) {
  return (mm / 25.4) * dpi;
}

export function sheetPixelSize(sheet, dpi) {
  return [Math.round(mmToPx(sheet.w, dpi)), Math.round(mmToPx(sheet.h, dpi))];
}

export function sheetFileName(index) {
  return `證件照-4x6-${index + 1}.jpg`;
}

// Draw the rotated crop frame into the target rect; white where outside the source
export function drawCrop(ctx, source, crop, size, x, y, w, h) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  const scale = w / (size.w * crop.pxPerMm);
  ctx.scale(scale, scale);
  ctx.rotate(-crop.angle);
  ctx.translate(-crop.cx, -crop.cy);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

const CUT_COLOR = "#bbbbbb";
const DASH_MM = [1.5, 1];   // Dash and gap length for the dashed style
const CORNER_MM = 3;        // Arm length of each corner mark

// Outline one photo for cutting: "solid" or "dashed" rectangle, or "corners" L-marks.
// The line sits just outside the photo, so it never covers any of the picture.
export function drawCutLines(ctx, x, y, w, h, style, dpi) {
  const lw = Math.max(1, mmToPx(0.1, dpi));
  const o = lw / 2; // Stroke is centered on its path: push the path out by half the width
  ctx.save();
  ctx.strokeStyle = CUT_COLOR;
  ctx.lineWidth = lw;
  if (style === "corners") {
    const a = Math.min(mmToPx(CORNER_MM, dpi), w / 3, h / 3) + o;
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [[x - o, y - o, 1, 1], [x + w + o, y - o, -1, 1], [x - o, y + h + o, 1, -1], [x + w + o, y + h + o, -1, -1]]) {
      ctx.moveTo(cx + dx * a, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * a);
    }
    ctx.stroke();
  } else {
    ctx.setLineDash(style === "dashed" ? DASH_MM.map((mm) => mmToPx(mm, dpi)) : []);
    ctx.strokeRect(x - o, y - o, w + 2 * o, h + 2 * o);
  }
  ctx.restore();
}

export function renderSheet(sheet, getPiece, settings) {
  const dpi = settings.dpi;
  const [cw, ch] = sheetPixelSize(sheet, dpi);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  const rects = sheet.items.map((item) => [item, ...[item.x, item.y, item.w, item.h].map((mm) => mmToPx(mm, dpi))]);
  for (const [item, x, y, w, h] of rects) {
    const { source, crop, size } = getPiece(item.key);
    drawCrop(ctx, source, crop, size, x, y, w, h);
  }
  // After every photo, so no photo's white fill paints over a neighbour's line
  if (settings.cutLines) {
    for (const [, x, y, w, h] of rects) drawCutLines(ctx, x, y, w, h, settings.cutStyle, dpi);
  }
  return canvas;
}

export function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("無法產生圖片"))), "image/jpeg", 0.95);
  });
}

export function triggerDownload(blob, fileName) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
