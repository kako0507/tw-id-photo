import { describe, expect, it } from "vitest";
import { createAppStore } from "./index.js";
import { viewerClosed, viewerOpened } from "./viewerSlice.js";

describe("viewer reducer", () => {
  it("starts closed, opens a sheet and closes again", () => {
    const store = createAppStore();
    expect(store.getState().viewer.sheetIndex).toBeNull();
    store.dispatch(viewerOpened(1));
    expect(store.getState().viewer.sheetIndex).toBe(1);
    store.dispatch(viewerClosed());
    expect(store.getState().viewer.sheetIndex).toBeNull();
  });
});
