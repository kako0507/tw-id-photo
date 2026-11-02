import { describe, expect, it } from "vitest";
import { createAppStore } from "./index.js";
import { countChanged, photoAdded, photoDecoded, photoDetected } from "./photosSlice.js";
import { selectPadded, selectPieceCount, selectPiece, selectSheets } from "./selectors.js";
import { editorApplied } from "./editorSlice.js";

function readyPhoto(store, id) {
  store.dispatch(photoAdded({ id, name: `${id}.jpg` }));
  store.dispatch(photoDecoded({ id, width: 1000, height: 1400 }));
  store.dispatch(photoDetected({ id, features: null }));
}

describe("selectors", () => {
  it("lays out every copy", () => {
    const store = createAppStore();
    readyPhoto(store, "a");
    const sheets = selectSheets(store.getState());
    expect(sheets).toHaveLength(1);
    expect(sheets[0].items).toHaveLength(8);
    expect(selectPieceCount(store.getState())).toBe(8);
    const piece = selectPiece(store.getState(), sheets[0].items[0].key);
    expect(piece).toMatchObject({ photoId: "a", sizeId: "2in" });
    expect(piece.crop.cx).toBe(500);
    expect(selectSheets(store.getState())).toBe(sheets); // memoized
  });

  it("returns no sheets when all counts are zero", () => {
    const store = createAppStore();
    readyPhoto(store, "a");
    store.dispatch(countChanged({ id: "a", sizeId: "2in", count: 0 }));
    store.dispatch(countChanged({ id: "a", sizeId: "1in", count: 0 }));
    expect(selectSheets(store.getState())).toEqual([]);
  });

  it("skips photos that are not ready", () => {
    const store = createAppStore();
    store.dispatch(photoAdded({ id: "a", name: "a.jpg" }));
    expect(selectSheets(store.getState())).toEqual([]);
  });

  it("derives padded from the crop", () => {
    const store = createAppStore();
    readyPhoto(store, "a");
    expect(selectPadded(store.getState(), "a", "2in")).toBe(false);
    const crop = { cx: 0, cy: 0, pxPerMm: 10, angle: 0 };
    store.dispatch(editorApplied({ photoId: "a", sizeId: "2in", crop }));
    expect(selectPadded(store.getState(), "a", "2in")).toBe(true);
  });
});
