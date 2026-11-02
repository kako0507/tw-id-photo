import { createSlice } from "@reduxjs/toolkit";

export const DEFAULT_SETTINGS = {
  marginMm: 3,    // Margin around the sheet edge (mm)
  gapMm: 2,       // Gap between photos (mm)
  cutLines: true, // Draw cut lines between photos
  dpi: 300,       // Output resolution
};

const RANGES = { marginMm: [0, 10], gapMm: [0, 10], dpi: [150, 600] };

// Clean value for a setting, or undefined when unusable (unknown key, wrong type, NaN).
// Ranges keep every built-in size packable onto a 4x6 sheet.
export function sanitizeSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return undefined;
  if (typeof value !== typeof DEFAULT_SETTINGS[key]) return undefined;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    const [lo, hi] = RANGES[key];
    return Math.min(hi, Math.max(lo, value));
  }
  return value;
}

const settingsSlice = createSlice({
  name: "settings",
  initialState: DEFAULT_SETTINGS,
  reducers: {
    settingChanged(state, { payload: { key, value } }) {
      const v = sanitizeSetting(key, value);
      if (v !== undefined) state[key] = v;
    },
    settingsReset: () => DEFAULT_SETTINGS,
  },
});

export const { settingChanged, settingsReset } = settingsSlice.actions;
export default settingsSlice.reducer;
