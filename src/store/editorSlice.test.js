import { describe, expect, it } from "vitest";
import { createAppStore } from "./index.js";
import {
  HISTORY_LIMIT, cropChanged, editStarted, editorOpened, editorRedone, editorUndone,
} from "./editorSlice.js";

const crop = (cx) => ({ cx, cy: 0, pxPerMm: 10, angle: 0 });

function edit(store, cx) {
  store.dispatch(editStarted());
  store.dispatch(cropChanged(crop(cx)));
}
const cur = (store) => store.getState().editor.crop.cx;

function open() {
  const store = createAppStore();
  store.dispatch(editorOpened({ photoId: "a", sizeId: "2in", crop: crop(0) }));
  return store;
}

describe("editor reducer", () => {
  it("undo and redo restore crops", () => {
    const store = open();
    edit(store, 1);
    edit(store, 2);
    store.dispatch(editorUndone());
    expect(cur(store)).toBe(1);
    store.dispatch(editorUndone());
    expect(cur(store)).toBe(0);
    store.dispatch(editorRedone());
    expect(cur(store)).toBe(1);
  });

  it("caps history at HISTORY_LIMIT", () => {
    const store = open();
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) edit(store, i);
    expect(store.getState().editor.past).toHaveLength(HISTORY_LIMIT);
  });

  it("a new edit clears redo", () => {
    const store = open();
    edit(store, 1);
    store.dispatch(editorUndone());
    expect(store.getState().editor.future).toHaveLength(1);
    edit(store, 5);
    expect(store.getState().editor.future).toHaveLength(0);
  });
});
