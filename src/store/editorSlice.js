import { createSlice } from "@reduxjs/toolkit";

// Crop editor. photoId === null means closed
const initialState = {
  photoId: null,
  sizeId: null,
  crop: null,   // { cx, cy, pxPerMm, angle } in source image pixels
  // Undo / redo stacks of crops. State is immutable, so a snapshot is just a reference
  past: [],
  future: [],
};

// Max undo steps kept; older ones are dropped so history never grows without bound
export const HISTORY_LIMIT = 50;

// Call before any undoable change: remember the current crop and drop the redo branch
function record(state) {
  state.past.push(state.crop);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    editorOpened: (_, { payload: { photoId, sizeId, crop } }) => ({ ...initialState, photoId, sizeId, crop }),
    editorClosed: () => initialState,
    // Call once when a drag / gesture begins so the whole gesture is one undo step
    editStarted(state) {
      if (state.photoId === null) return;
      record(state);
    },
    cropChanged(state, { payload: crop }) {
      state.crop = crop;
    },
    editorUndone(state) {
      if (!state.past.length) return;
      state.future.push(state.crop);
      state.crop = state.past.pop();
    },
    editorRedone(state) {
      if (!state.future.length) return;
      state.past.push(state.crop);
      state.crop = state.future.pop();
    },
    editorAutoCropped(state, { payload: crop }) {
      record(state);
      state.crop = crop;
    },
    // photosSlice also handles this action to write the result back to the photo
    editorApplied: () => initialState,   // payload: { photoId, sizeId, crop }
  },
});

export const {
  editorOpened, editorClosed, editStarted, cropChanged,
  editorUndone, editorRedone, editorAutoCropped, editorApplied,
} = editorSlice.actions;
export default editorSlice.reducer;
