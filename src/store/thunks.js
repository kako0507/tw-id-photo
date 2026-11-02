// All side effects (decoding, face detection, pixel sampling, downloads) live in thunks so reducers stay pure.
// Plain thunks instead of createAsyncThunk: File objects are not serializable and must
// not end up in action meta
import { nanoid } from "@reduxjs/toolkit";
import { autoCrop, centeredCrop } from "../lib/crop.js";
import { decodeImage } from "../lib/decode.js";
import { detectFace } from "../lib/face.js";
import { HEAD_TOP_FALLBACK, findHeadTop } from "../lib/headTop.js";
import { clearImages, getImage, removeImage, setImage } from "../lib/imageCache.js";
import { canvasToJpeg, renderSheet, sheetFileName, triggerDownload } from "../lib/render.js";
import { SIZE_BY_ID } from "../lib/sizes.js";
import { editorApplied, editorAutoCropped, editorClosed, editorOpened } from "./editorSlice.js";
import {
  photoAdded, photoDecoded, photoDetected, photoFailed, photoRemoved, photosCleared,
} from "./photosSlice.js";
import { selectPiece, selectSheets } from "./selectors.js";

const SCAN_MAX_SIDE = 1280; // Longest side of the image used for the head-top scan
const ERR_NO_FACE = "沒找到臉，請手動裁切";
const ERR_MODEL = "人臉偵測載入失敗，請手動裁切";

// Draw the source downscaled by `scale` and return its pixels
function sampleImage(source, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Scan upward from the forehead for the top of the hair; returns the y in source pixels
function scanHeadTop(source, { leftEye, rightEye, forehead, chin }) {
  const s = Math.min(1, SCAN_MAX_SIDE / Math.max(source.width, source.height));
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const fallbackY = (forehead.y - HEAD_TOP_FALLBACK * (chin.y - forehead.y)) * s;
  const { y } = findHeadTop(
    sampleImage(source, s),
    { x: forehead.x * s, y: forehead.y * s, halfWidth: 0.75 * eyeDist * s },
    fallbackY,
  );
  return y / s;
}

// Detect the face and write features (or an error with centered crops) to the photo
export const detectPhoto = (id) => async (dispatch) => {
  const source = getImage(id);
  if (!source) return;
  let f;
  try {
    f = await detectFace(source);
  } catch {
    dispatch(photoDetected({ id, features: null, error: ERR_MODEL }));
    return;
  }
  if (!f) {
    dispatch(photoDetected({ id, features: null, error: ERR_NO_FACE }));
    return;
  }
  const y = scanHeadTop(source, f);
  dispatch(photoDetected({ id, features: { ...f, headTop: { x: f.forehead.x, y } } }));
};

export const addFiles = (files) => async (dispatch, getState) => {
  for (const file of files) {
    const id = nanoid();
    dispatch(photoAdded({ id, name: file.name }));
    let bitmap;
    try {
      bitmap = await decodeImage(file);
    } catch (err) {
      dispatch(photoFailed({ id, error: err.message }));
      continue;
    }
    if (!getState().photos.entities[id]) {  // Removed while decoding
      bitmap.close?.();
      continue;
    }
    setImage(id, bitmap);
    dispatch(photoDecoded({ id, width: bitmap.width, height: bitmap.height }));
    // One after another so the model loads once
    await dispatch(detectPhoto(id));
  }
};

export const removePhoto = (id) => (dispatch, getState) => {
  if (getState().editor.photoId === id) dispatch(editorClosed());
  removeImage(id);
  dispatch(photoRemoved(id));
};

export const clearAll = () => (dispatch) => {
  dispatch(editorClosed());
  clearImages();
  dispatch(photosCleared());
};

export const openEditor = (photoId, sizeId) => (dispatch, getState) => {
  const crop = getState().photos.entities[photoId]?.crops[sizeId];
  if (crop) dispatch(editorOpened({ photoId, sizeId, crop }));
};

// Recompute the automatic crop for the photo open in the editor
export const autoCropInEditor = () => (dispatch, getState) => {
  const { photoId, sizeId } = getState().editor;
  const p = getState().photos.entities[photoId];
  if (!p) return;
  const size = SIZE_BY_ID[sizeId];
  dispatch(editorAutoCropped(p.features ? autoCrop(p.features, size) : centeredCrop(p.width, p.height, size)));
};

export const applyEditor = () => (dispatch, getState) => {
  const { photoId, sizeId, crop } = getState().editor;
  if (photoId === null) return;
  dispatch(editorApplied({ photoId, sizeId, crop }));
};

export const downloadSheets = () => async (_dispatch, getState) => {
  const state = getState();
  const getPiece = (key) => {
    const { photoId, sizeId, crop } = selectPiece(state, key);
    return { source: getImage(photoId), crop, size: SIZE_BY_ID[sizeId] };
  };
  const sheets = selectSheets(state);
  for (let i = 0; i < sheets.length; i++) {
    const canvas = renderSheet(sheets[i], getPiece, state.settings);
    triggerDownload(await canvasToJpeg(canvas), sheetFileName(i));
  }
};
