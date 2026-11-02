"""Regenerate e2e/fixtures/sample-2in.jpg from the original sample photo by removing its two
thin horizontal guide lines (head top, chin).
Usage: python scripts/clean_sample.py <original.jpg> <out.jpg>   (needs opencv-python and numpy)

Each line is found as rows that are much darker than the rows around them. Every affected
column is then repainted by blending the clean pixels just above and below the line, which
keeps hair strands (mostly vertical) continuous.
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src).astype(float)
h, w = img.shape[:2]
gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(int)

rows = []
for y in range(3, h - 3):
    diff = (gray[y - 3] + gray[y + 3]) / 2 - gray[y]
    if (diff[int(w * 0.6):] > 15).mean() > 0.6:
        start = np.where(diff > 15)[0]
        rows.append((y, start[start > w * 0.3].min()))

# Group neighbouring rows into lines and widen by one row on each side (JPEG ringing)
lines = []
for y, x0 in rows:
    if lines and y - lines[-1][1] <= 2:
        lines[-1][1] = y
        lines[-1][2] = min(lines[-1][2], x0)
    else:
        lines.append([y, y, x0])

out = img.copy()
mask = np.zeros((h, w), np.uint8)
for top, bottom, x0 in lines:
    if gray[top - 4, w // 2:].mean() > 235:
        # Line on the white background touching the hair top: inpaint keeps the hair edge sharp
        mask[top - 1:bottom + 2, max(0, x0 - 4):] = 255
        print(f"inpaint rows {top}-{bottom}, from x={x0}")
        continue
    # Line across hair: blend the clean rows above and below, column by column
    top, bottom, x0 = top - 2, bottom + 2, max(0, x0 - 4)
    above, below = img[top - 1, x0:], img[bottom + 1, x0:]
    n = bottom - top + 2
    for i, y in enumerate(range(top, bottom + 1), start=1):
        t = i / n
        out[y, x0:] = above * (1 - t) + below * t
    print(f"blend rows {top}-{bottom}, from x={x0}")

out = np.clip(out, 0, 255).astype(np.uint8)
out = cv2.inpaint(out, mask, 3, cv2.INPAINT_TELEA)
cv2.imwrite(dst, out, [cv2.IMWRITE_JPEG_QUALITY, 95])
