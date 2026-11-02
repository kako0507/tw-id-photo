import { createSlice } from "@reduxjs/toolkit";

export const DEFAULT_SETTINGS = {
  marginMm: 3,    // Margin around the sheet edge (mm)
  gapMm: 2,       // Gap between photos (mm)
  cutLines: true, // Draw cut lines between photos
  dpi: 300,       // Output resolution
};

const settingsSlice = createSlice({
  name: "settings",
  initialState: DEFAULT_SETTINGS,
  reducers: {
    settingChanged(state, { payload: { key, value } }) {
      if (key in DEFAULT_SETTINGS) state[key] = value;
    },
    settingsReset: () => DEFAULT_SETTINGS,
  },
});

export const { settingChanged, settingsReset } = settingsSlice.actions;
export default settingsSlice.reducer;
