// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createAppStore } from "./index.js";
import { loadSettings, persistSettings } from "./persistence.js";
import { DEFAULT_SETTINGS, settingChanged, settingsReset } from "./settingsSlice.js";

const KEY = "tw-id-photo-settings";

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});

describe("settings reducer", () => {
  it("changes known keys only and resets to defaults", () => {
    const store = createAppStore();
    store.dispatch(settingChanged({ key: "gapMm", value: 5 }));
    store.dispatch(settingChanged({ key: "bogus", value: 1 }));
    expect(store.getState().settings.gapMm).toBe(5);
    expect(store.getState().settings).not.toHaveProperty("bogus");
    store.dispatch(settingsReset());
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("loadSettings", () => {
  it("ignores bad stored values", () => {
    localStorage.setItem(KEY, JSON.stringify({ marginMm: "5", cutLines: false, bogus: 1 }));
    const s = loadSettings();
    expect(s.marginMm).toBe(DEFAULT_SETTINGS.marginMm);
    expect(s.cutLines).toBe(false);
    expect(s).not.toHaveProperty("bogus");
    localStorage.setItem(KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("URL parameters override stored settings", () => {
    localStorage.setItem(KEY, JSON.stringify({ gapMm: 1 }));
    history.replaceState(null, "", "/?gapMm=4&cutLines=0");
    expect(loadSettings()).toMatchObject({ gapMm: 4, cutLines: false });
  });
});

describe("setting validation", () => {
  it("keeps the default for an unparsable URL number", () => {
    history.replaceState(null, "", "/?gapMm=abc");
    expect(loadSettings().gapMm).toBe(DEFAULT_SETTINGS.gapMm);
  });

  it("clamps out-of-range URL numbers", () => {
    history.replaceState(null, "", "/?marginMm=99&dpi=0");
    expect(loadSettings()).toMatchObject({ marginMm: 10, dpi: 150 });
  });

  it("clamps changed settings and ignores unusable ones", () => {
    const store = createAppStore();
    store.dispatch(settingChanged({ key: "gapMm", value: -5 }));
    expect(store.getState().settings.gapMm).toBe(0);
    store.dispatch(settingChanged({ key: "gapMm", value: "x" }));
    expect(store.getState().settings.gapMm).toBe(0);
  });
});

describe("persistSettings", () => {
  it("saves settings after a change", () => {
    const store = createAppStore(loadSettings());
    persistSettings(store);
    expect(localStorage.getItem(KEY)).toBeNull();
    store.dispatch(settingChanged({ key: "dpi", value: 600 }));
    expect(JSON.parse(localStorage.getItem(KEY)).dpi).toBe(600);
  });
});
