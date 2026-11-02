import { DEFAULT_SETTINGS, sanitizeSetting } from "./settingsSlice.js";

const STORAGE_KEY = "tw-id-photo-settings";

// Read before creating the store: saved settings from localStorage, overridden by URL
// parameters (e.g. ?gapMm=4)
export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
  const s = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const v = sanitizeSetting(key, saved[key]);
    if (v !== undefined) s[key] = v;
  }
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!params.has(key)) continue;
    const raw = params.get(key);
    let v = raw;
    if (typeof DEFAULT_SETTINGS[key] === "number") v = raw.trim() === "" ? NaN : Number(raw);
    else if (typeof DEFAULT_SETTINGS[key] === "boolean") v = raw === "1" || raw === "true" ? true : raw === "0" || raw === "false" ? false : undefined;
    v = sanitizeSetting(key, v);
    if (v !== undefined) s[key] = v;
  }
  return s;
}

// Saved via store.subscribe, never inside a reducer (reducers must be side-effect free)
export function persistSettings(store) {
  let last = store.getState().settings;
  store.subscribe(() => {
    const settings = store.getState().settings;
    if (settings === last) return;
    last = settings;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  });
}
