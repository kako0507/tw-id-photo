import { useEffect, useRef } from "react";
import { useSelector, useStore } from "react-redux";
import { getImage } from "../lib/imageCache.js";
import { renderSheet } from "../lib/render.js";
import { SIZE_BY_ID } from "../lib/sizes.js";
import { selectPiece, selectSheets } from "../store/selectors.js";

const PREVIEW_SCALE = 0.25;

function SheetCanvas({ sheet, index }) {
  const store = useStore();
  const settings = useSelector((state) => state.settings);
  const photos = useSelector((state) => state.photos); // Crops live here; redraw when they change
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const state = store.getState();
    const getPiece = (key) => {
      const { photoId, sizeId, crop } = selectPiece(state, key);
      return { source: getImage(photoId), crop, size: SIZE_BY_ID[sizeId] };
    };
    // Render at a quarter of the print DPI: 16x fewer pixels than drawing the full
    // sheet and scaling it down, through the same code path as the export
    const small = renderSheet(sheet, getPiece, { ...settings, dpi: settings.dpi * PREVIEW_SCALE });
    canvas.width = small.width;
    canvas.height = small.height;
    canvas.getContext("2d").drawImage(small, 0, 0);
  }, [store, sheet, settings, photos]);

  return (
    <figure className="sheet">
      <canvas ref={ref} />
      <figcaption>第 {index + 1} 張（{sheet.orientation === "landscape" ? "橫式" : "直式"}）</figcaption>
    </figure>
  );
}

export default function SheetPreview() {
  const sheets = useSelector(selectSheets);
  if (!sheets.length) return <p className="empty">尚未選擇張數</p>;
  return (
    <div className="sheets">
      {sheets.map((sheet, i) => <SheetCanvas key={i} sheet={sheet} index={i} />)}
    </div>
  );
}
