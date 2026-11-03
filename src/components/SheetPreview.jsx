import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectSheets } from "../store/selectors.js";
import { viewerOpened } from "../store/viewerSlice.js";
import { useSheetCanvas } from "./useSheetCanvas.js";

// A quarter of the print DPI: 16x fewer pixels than drawing the full sheet and scaling down
const PREVIEW_SCALE = 0.25;

function SheetCanvas({ sheet, index }) {
  const dispatch = useDispatch();
  const ref = useRef(null);
  useSheetCanvas(ref, sheet, PREVIEW_SCALE);
  const label = `第 ${index + 1} 張（${sheet.orientation === "landscape" ? "橫式" : "直式"}）`;
  return (
    <figure className="sheet">
      <button type="button" className="sheet-open" title="點一下放大，看尺寸刻度"
        aria-label={`放大檢視${label}`} onClick={() => dispatch(viewerOpened(index))}>
        <canvas ref={ref} />
      </button>
      <figcaption>{label}・點一下看尺寸</figcaption>
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
