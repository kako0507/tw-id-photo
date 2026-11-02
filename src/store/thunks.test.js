import { beforeEach, describe, expect, it, vi } from "vitest";

// Replace the browser-only pieces (decoding, model, pixel scan, canvas export) with fakes
vi.mock("../lib/decode.js", () => ({ decodeImage: vi.fn() }));
vi.mock("../lib/face.js", () => ({ detectFace: vi.fn() }));
vi.mock("../lib/headTop.js", () => ({ HEAD_TOP_FALLBACK: 0.35, findHeadTop: vi.fn() }));
vi.mock("../lib/render.js", () => ({
  renderSheet: vi.fn(() => ({})),
  canvasToJpeg: vi.fn(async () => "blob"),
  triggerDownload: vi.fn(),
  sheetFileName: (i) => `證件照-4x6-${i + 1}.jpg`,
}));

const { decodeImage } = await import("../lib/decode.js");
const { detectFace } = await import("../lib/face.js");
const { findHeadTop } = await import("../lib/headTop.js");
const { renderSheet, triggerDownload } = await import("../lib/render.js");
const { getImage } = await import("../lib/imageCache.js");
const { createAppStore } = await import("./index.js");
const { addFiles, applyEditor, clearAll, downloadSheets, openEditor, removePhoto } = await import("./thunks.js");

const bitmap = (width = 2000, height = 1000) => ({ width, height, close: vi.fn() });
const file = (name) => ({ name });
const features = {
  leftEye: { x: 800, y: 500 }, rightEye: { x: 1000, y: 500 },
  forehead: { x: 900, y: 400 }, chin: { x: 900, y: 800 }, angle: 0,
};
const photos = (store) => Object.values(store.getState().photos.entities);

let store;
beforeEach(() => {
  vi.clearAllMocks();
  store = createAppStore();
  decodeImage.mockImplementation(async () => bitmap());
  detectFace.mockResolvedValue(features);
  findHeadTop.mockReturnValue({ y: 100, found: true });
  // Minimal canvas for the pixel sampling step
  const ctx = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: [], width: 0, height: 0 })) };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx }) });
});

describe("addFiles", () => {
  it("adds, decodes and detects each file", async () => {
    await store.dispatch(addFiles([file("a.jpg"), file("b.jpg")]));
    const [a, b] = photos(store);
    expect(photos(store)).toHaveLength(2);
    expect(a).toMatchObject({ name: "a.jpg", status: "ready", width: 2000, height: 1000, error: null });
    expect(b.status).toBe("ready");
    expect(detectFace).toHaveBeenCalledTimes(2);
    expect(getImage(a.id)).toBeTruthy();
  });

  it("marks undecodable files as errors", async () => {
    decodeImage.mockRejectedValueOnce(new Error("壞檔"));
    await store.dispatch(addFiles([file("bad.jpg")]));
    expect(photos(store)[0]).toMatchObject({ status: "error", error: "壞檔" });
    expect(detectFace).not.toHaveBeenCalled();
  });

  it("falls back to centered crops when the model fails", async () => {
    detectFace.mockRejectedValueOnce(new Error("network"));
    await store.dispatch(addFiles([file("a.jpg")]));
    const p = photos(store)[0];
    expect(p).toMatchObject({ status: "ready", features: null, error: "人臉偵測載入失敗，請手動裁切" });
    expect(p.crops["2in"]).toMatchObject({ cx: 1000, cy: 500, angle: 0 });
  });

  it("reports when no face is found", async () => {
    detectFace.mockResolvedValueOnce(null);
    await store.dispatch(addFiles([file("a.jpg")]));
    expect(photos(store)[0]).toMatchObject({ status: "ready", error: "沒找到臉，請手動裁切" });
  });

  it("uses the head-top scan result", async () => {
    await store.dispatch(addFiles([file("a.jpg")]));
    // 2000px long side -> scale 0.64; scanned y 100 maps back to 100 / 0.64
    const [, args, fallbackY] = findHeadTop.mock.calls[0];
    expect(args.x).toBeCloseTo(900 * 0.64);
    expect(args.halfWidth).toBeCloseTo(0.75 * 200 * 0.64);
    expect(fallbackY).toBeCloseTo((400 - 0.35 * 400) * 0.64);
    expect(photos(store)[0].features.headTop).toEqual({ x: 900, y: 100 / 0.64 });
  });
});

describe("removePhoto / clearAll", () => {
  it("clears cache entries and closes the editor on the removed photo", async () => {
    await store.dispatch(addFiles([file("a.jpg")]));
    const { id } = photos(store)[0];
    store.dispatch(openEditor(id, "2in"));
    expect(store.getState().editor.photoId).toBe(id);
    store.dispatch(removePhoto(id));
    expect(store.getState().editor.photoId).toBeNull();
    expect(getImage(id)).toBeUndefined();
    expect(photos(store)).toHaveLength(0);
  });

  it("clearAll empties photos and the cache", async () => {
    await store.dispatch(addFiles([file("a.jpg")]));
    const { id } = photos(store)[0];
    store.dispatch(clearAll());
    expect(photos(store)).toHaveLength(0);
    expect(getImage(id)).toBeUndefined();
  });
});

describe("editor", () => {
  it("applies the editor crop as a manual crop", async () => {
    await store.dispatch(addFiles([file("a.jpg")]));
    const { id } = photos(store)[0];
    store.dispatch(openEditor(id, "2in"));
    store.dispatch(applyEditor());
    expect(store.getState().editor.photoId).toBeNull();
    expect(photos(store)[0].manual["2in"]).toBe(true);
  });
});

describe("downloadSheets", () => {
  it("downloads one file per sheet", async () => {
    await store.dispatch(addFiles([file("a.jpg")]));
    await store.dispatch(downloadSheets());
    expect(renderSheet).toHaveBeenCalledTimes(1);
    expect(triggerDownload).toHaveBeenCalledWith("blob", "證件照-4x6-1.jpg");
  });
});
