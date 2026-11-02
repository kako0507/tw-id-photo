import { describe, expect, it } from "vitest";
import { createAppStore } from "./index.js";
import { editorApplied } from "./editorSlice.js";
import { countChanged, photoAdded, photoDecoded, photoDetected } from "./photosSlice.js";
import { SIZES } from "../lib/sizes.js";

const features = {
  leftEye: { x: 400, y: 500 }, rightEye: { x: 600, y: 500 },
  headTop: { x: 500, y: 300 }, chin: { x: 500, y: 900 }, angle: 0,
};

function addPhoto(store, id = "a") {
  store.dispatch(photoAdded({ id, name: "a.jpg" }));
  store.dispatch(photoDecoded({ id, width: 1000, height: 1400 }));
}
const photo = (store, id = "a") => store.getState().photos.entities[id];

describe("photos reducer", () => {
  it("starts with the default counts", () => {
    const store = createAppStore();
    store.dispatch(photoAdded({ id: "a", name: "a.jpg" }));
    expect(photo(store).status).toBe("decoding");
    expect(photo(store).counts).toEqual({ "2in": 4, "1in": 4 });
  });

  it("crops every size after detection", () => {
    const store = createAppStore();
    addPhoto(store);
    store.dispatch(photoDetected({ id: "a", features }));
    expect(photo(store).status).toBe("ready");
    for (const s of SIZES) expect(photo(store).crops[s.id].pxPerMm).toBeGreaterThan(0);
    expect(photo(store).crops["2in"].pxPerMm).toBeCloseTo(600 / 34);
  });

  it("uses centered crops when no face was found", () => {
    const store = createAppStore();
    addPhoto(store);
    store.dispatch(photoDetected({ id: "a", features: null, error: "找不到臉" }));
    expect(photo(store).error).toBe("找不到臉");
    expect(photo(store).crops["2in"]).toMatchObject({ cx: 500, cy: 700, angle: 0 });
  });

  it("keeps manual crops on re-detection", () => {
    const store = createAppStore();
    addPhoto(store);
    const crop = { cx: 1, cy: 2, pxPerMm: 3, angle: 0.1 };
    store.dispatch(editorApplied({ photoId: "a", sizeId: "1in", crop }));
    expect(photo(store).manual["1in"]).toBe(true);
    store.dispatch(photoDetected({ id: "a", features }));
    expect(photo(store).crops["1in"]).toEqual(crop);
    expect(photo(store).crops["2in"]).not.toEqual(crop);
  });

  it("clamps counts to 0-20", () => {
    const store = createAppStore();
    addPhoto(store);
    store.dispatch(countChanged({ id: "a", sizeId: "2in", count: 99 }));
    expect(photo(store).counts["2in"]).toBe(20);
    store.dispatch(countChanged({ id: "a", sizeId: "2in", count: -3 }));
    expect(photo(store).counts["2in"]).toBe(0);
    store.dispatch(countChanged({ id: "a", sizeId: "2in", count: 2.6 }));
    expect(photo(store).counts["2in"]).toBe(3);
  });
});
