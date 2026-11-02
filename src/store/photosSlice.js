import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import { autoCrop, centeredCrop } from "../lib/crop.js";
import { DEFAULT_COUNTS, SIZES } from "../lib/sizes.js";
import { editorApplied } from "./editorSlice.js";

// Photo ids must not contain ":" (piece keys are `${id}:${sizeId}:${n}`); use nanoid() from RTK.
export const photosAdapter = createEntityAdapter();

const MAX_COUNT = 20;

const photosSlice = createSlice({
  name: "photos",
  initialState: photosAdapter.getInitialState(),
  reducers: {
    photoAdded(state, { payload: { id, name } }) {
      photosAdapter.addOne(state, {
        id, name, status: "decoding", error: null, width: 0, height: 0,
        features: null, crops: {}, manual: {}, counts: { ...DEFAULT_COUNTS },
      });
    },
    photoDecoded(state, { payload: { id, width, height } }) {
      const p = state.entities[id];
      if (!p) return;
      p.width = width;
      p.height = height;
      p.status = "detecting";
    },
    // features already include headTop; null/undefined features fall back to centered crops
    photoDetected(state, { payload: { id, features, error } }) {
      const p = state.entities[id];
      if (!p) return;
      p.features = features || null;
      p.error = error || null;
      for (const size of SIZES) {
        if (p.manual[size.id]) continue;
        p.crops[size.id] = features ? autoCrop(features, size) : centeredCrop(p.width, p.height, size);
      }
      p.status = "ready";
    },
    photoFailed(state, { payload: { id, error } }) {
      const p = state.entities[id];
      if (!p) return;
      p.status = "error";
      p.error = error;
    },
    countChanged(state, { payload: { id, sizeId, count } }) {
      const p = state.entities[id];
      if (!p) return;
      const n = Math.round(Number(count));
      p.counts[sizeId] = Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(0, n)) : 0;
    },
    photoRemoved: photosAdapter.removeOne,
    photosCleared: photosAdapter.removeAll,
  },
  extraReducers: (builder) => {
    builder.addCase(editorApplied, (state, { payload: { photoId, sizeId, crop } }) => {
      const p = state.entities[photoId];
      if (!p) return;
      p.crops[sizeId] = crop;
      p.manual[sizeId] = true;
    });
  },
});

export const {
  photoAdded, photoDecoded, photoDetected, photoFailed, countChanged, photoRemoved, photosCleared,
} = photosSlice.actions;
export default photosSlice.reducer;
