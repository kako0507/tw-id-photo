import { configureStore } from "@reduxjs/toolkit";
import editor from "./editorSlice.js";
import photos from "./photosSlice.js";
import settings from "./settingsSlice.js";

// The whole app has exactly one store (single source of truth).
// In development configureStore checks for state mutation and non-serializable actions/state
export function createAppStore(preloadedSettings) {
  return configureStore({
    reducer: { settings, photos, editor },
    preloadedState: preloadedSettings ? { settings: preloadedSettings } : undefined,
  });
}
