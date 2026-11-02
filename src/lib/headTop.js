// Finds the top of the hair by scanning upward from the forehead until the
// rows look like the plain background.

export const HEAD_TOP_FALLBACK = 0.35;

const DIFF_THRESHOLD = 40; // RGB distance that counts as "not background"
const ROW_DIFF_RATIO = 0.1; // a row is background when fewer pixels differ
const RUN_LENGTH = 3; // consecutive background rows that end the scan
const EDGE_RATIO = 0.05; // top rows / outer columns sampled for the background

function median(values) {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

// Per-channel median of the top 5% rows x outer 5% columns (both sides).
function backgroundColor({ data, width, height }) {
  const rows = Math.max(1, Math.floor(height * EDGE_RATIO));
  const cols = Math.max(1, Math.floor(width * EDGE_RATIO));
  const ch = [[], [], []];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= cols && x < width - cols) continue;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) ch[c].push(data[i + c]);
    }
  }
  return ch.map(median);
}

export function findHeadTop(image, { x, y, halfWidth }, fallbackY) {
  const { data, width, height } = image;
  const bg = backgroundColor(image);
  const x0 = Math.max(0, Math.round(x - halfWidth));
  const x1 = Math.min(width - 1, Math.round(x + halfWidth));
  const startY = Math.min(height - 1, Math.round(y));
  const total = x1 - x0 + 1;

  let run = 0;
  for (let row = startY; row >= 0; row--) {
    let diff = 0;
    for (let col = x0; col <= x1; col++) {
      const i = (row * width + col) * 4;
      const dr = data[i] - bg[0];
      const dg = data[i + 1] - bg[1];
      const db = data[i + 2] - bg[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > DIFF_THRESHOLD) diff++;
    }
    if (diff / total < ROW_DIFF_RATIO) {
      run++;
      // run covers row .. row + RUN_LENGTH - 1; head top is just below it
      if (run === RUN_LENGTH) return { y: row + RUN_LENGTH, found: true };
    } else {
      run = 0;
    }
  }
  return { y: Math.max(0, fallbackY), found: false };
}
