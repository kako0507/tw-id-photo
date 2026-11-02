import { createSelector } from "@reduxjs/toolkit";
import { isPadded } from "../lib/crop.js";
import { layoutSheets } from "../lib/layout.js";
import { SIZES, SIZE_BY_ID } from "../lib/sizes.js";
import { photosAdapter } from "./photosSlice.js";

const photoSelectors = photosAdapter.getSelectors((state) => state.photos);

const selectPhotos = (state) => state.photos;
const selectSettings = (state) => state.settings;

// One entry per copy to print, in SIZES order; only ready photos contribute
export const selectSheets = createSelector([selectPhotos, selectSettings], (photos, { marginMm, gapMm }) => {
  const pieces = [];
  for (const size of SIZES) {
    for (const id of photos.ids) {
      const p = photos.entities[id];
      if (p.status !== "ready") continue;
      for (let n = 0; n < (p.counts[size.id] || 0); n++) {
        pieces.push({ key: `${id}:${size.id}:${n}`, w: size.w, h: size.h });
      }
    }
  }
  return layoutSheets(pieces, { marginMm, gapMm });
});

// Resolve a layout item key back to its photo, size and crop
export function selectPiece(state, key) {
  const [photoId, sizeId] = key.split(":");
  const crop = photoSelectors.selectById(state, photoId)?.crops[sizeId];
  return { photoId, sizeId, crop };
}

// Whether the crop reaches outside the source image (derived, never stored)
export function selectPadded(state, id, sizeId) {
  const p = photoSelectors.selectById(state, id);
  const crop = p?.crops[sizeId];
  if (!crop) return false;
  return isPadded(crop, SIZE_BY_ID[sizeId], p.width, p.height);
}

export const selectPieceCount = createSelector([selectSheets], (sheets) =>
  sheets.reduce((n, s) => n + s.items.length, 0));
