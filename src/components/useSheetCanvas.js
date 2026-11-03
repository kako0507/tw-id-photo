import { useEffect } from "react";
import { useSelector, useStore } from "react-redux";
import { getImage } from "../lib/imageCache.js";
import { renderSheet } from "../lib/render.js";
import { SIZE_BY_ID } from "../lib/sizes.js";
import { selectPiece } from "../store/selectors.js";

// Draw a sheet into canvasRef at `scale` x the print DPI, through the same code path as
// the export. The canvas is a projection of state: it redraws when crops or settings change
export function useSheetCanvas(canvasRef, sheet, scale) {
  const store = useStore();
  const settings = useSelector((state) => state.settings);
  const photos = useSelector((state) => state.photos); // Crops live here
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheet) return;
    const state = store.getState();
    const getPiece = (key) => {
      const { photoId, sizeId, crop } = selectPiece(state, key);
      return { source: getImage(photoId), crop, size: SIZE_BY_ID[sizeId] };
    };
    const out = renderSheet(sheet, getPiece, { ...settings, dpi: settings.dpi * scale });
    canvas.width = out.width;
    canvas.height = out.height;
    canvas.getContext("2d").drawImage(out, 0, 0);
  }, [canvasRef, store, sheet, settings, photos, scale]);
}
