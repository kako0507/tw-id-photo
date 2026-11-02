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

export function renderSheet(sheet, getPiece, settings) {
  const dpi = settings.dpi;
  const [cw, ch] = sheetPixelSize(sheet, dpi);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  const lineWidth = Math.max(1, mmToPx(0.1, dpi));
  for (const item of sheet.items) {
    const { source, crop, size } = getPiece(item.key);
    const x = mmToPx(item.x, dpi);
    const y = mmToPx(item.y, dpi);
    const w = mmToPx(item.w, dpi);
    const h = mmToPx(item.h, dpi);
    drawCrop(ctx, source, crop, size, x, y, w, h);
    if (settings.cutLines) {
      ctx.strokeStyle = "#bbbbbb";
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x, y, w, h);
    }
  }
  return canvas;
}

export function canvasToJpeg(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
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
