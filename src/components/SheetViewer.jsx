import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { formatMm, itemAt, rulerTicks } from "../lib/ruler.js";
import { SIZE_BY_ID } from "../lib/sizes.js";
import { selectPiece, selectSheets } from "../store/selectors.js";
import { viewerClosed, viewerOpened } from "../store/viewerSlice.js";
import { useSheetCanvas } from "./useSheetCanvas.js";

const VIEW_SCALE = 0.5; // Half the print DPI: sharp enough when enlarged on screen
const R = 12;           // Ruler thickness (mm of sheet space): span label strip + cm numbers + ticks
const TICK = { cm: 4, half: 2.6, mm: 1.5 }; // Tick lengths (mm)

// Ruler along one sheet edge: "top" runs along x, "left" along y.
// span = [from, to] in mm highlights the hovered photo's extent
function Ruler({ side, length, span }) {
  const top = side === "top";
  const at = (along, across) => (top ? { x: along, y: across } : { x: across, y: along });
  const band = (from, to) => (top
    ? { x: from, y: -R, width: to - from, height: R }
    : { x: -R, y: from, width: R, height: to - from });
  const ticks = rulerTicks(length);
  return (
    <g className="ruler">
      <rect {...band(0, length)} />
      {span && <rect className="ruler-span" {...band(span[0], span[1])} />}
      {ticks.map(({ mm, kind }) => {
        const a = at(mm, 0), b = at(mm, -TICK[kind]);
        return <line key={mm} className={`tick ${kind}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {ticks.filter((t) => t.kind === "cm" && t.mm > 0).map(({ mm }) => {
        const p = at(mm, -6);
        return (
          <text key={mm} className="tick-label" x={p.x} y={p.y}
            transform={top ? undefined : `rotate(-90 ${p.x} ${p.y})`}>{mm / 10}</text>
        );
      })}
    </g>
  );
}

// Enlarged sheet with cm rulers on two edges; hovering a photo shows its size
export default function SheetViewer() {
  const index = useSelector((state) => state.viewer.sheetIndex);
  const sheets = useSelector(selectSheets);
  const sheet = index === null ? null : sheets[index] ?? null;
  const store = useStore();
  const dispatch = useDispatch();
  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const [hoverKey, setHoverKey] = useState(null);
  useSheetCanvas(canvasRef, sheet, VIEW_SCALE);

  // The sheet can disappear (photo removed, counts lowered): close rather than reopen later
  useEffect(() => {
    if (index !== null && !sheet) dispatch(viewerClosed());
  }, [index, sheet, dispatch]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (sheet && !dialog.open) dialog.showModal();
    if (!sheet && dialog.open) dialog.close();
  }, [sheet]);

  useEffect(() => setHoverKey(null), [index]);

  // Pointer position -> sheet mm through the SVG's own transform
  const onPointer = (e) => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current.getScreenCTM().inverse());
    setHoverKey(itemAt(sheet, pt.x, pt.y)?.key ?? null);
  };

  const close = () => dispatch(viewerClosed());
  const hover = sheet?.items.find((it) => it.key === hoverKey);
  const size = hover && SIZE_BY_ID[selectPiece(store.getState(), hover.key).sizeId];
  const mid = -R + 2.2; // Across-position of the span labels: outer strip of the ruler

  return (
    <dialog ref={dialogRef} className="viewer" onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}>
      {sheet && (
        <>
          <div className="editor-head">
            <strong>第 {index + 1} 張 4×6（{sheet.orientation === "landscape" ? "橫式" : "直式"}）</strong>
            <span>刻度單位 cm，滑過或點一下照片看尺寸</span>
          </div>
          <div className="viewer-stage">
            <svg ref={svgRef} viewBox={`${-R} ${-R} ${sheet.w + R + 1} ${sheet.h + R + 1}`}
              onPointerMove={onPointer} onPointerDown={onPointer}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") setHoverKey(null); }}>
              <foreignObject x={0} y={0} width={sheet.w} height={sheet.h}>
                <canvas ref={canvasRef} className="viewer-canvas" />
              </foreignObject>
              <rect className="sheet-edge" x={0} y={0} width={sheet.w} height={sheet.h} />
              <Ruler side="top" length={sheet.w} span={hover && [hover.x, hover.x + hover.w]} />
              <Ruler side="left" length={sheet.h} span={hover && [hover.y, hover.y + hover.h]} />
              <text className="ruler-unit" x={-6} y={-6}>cm</text>
              {hover && (
                <g className="measure">
                  {/* The photo's four edges, extended as dashed lines to the rulers */}
                  {[hover.x, hover.x + hover.w].map((x) => (
                    <line key={`v${x}`} x1={x} y1={-R} x2={x} y2={hover.y + hover.h} />
                  ))}
                  {[hover.y, hover.y + hover.h].map((y) => (
                    <line key={`h${y}`} x1={-R} y1={y} x2={hover.x + hover.w} y2={y} />
                  ))}
                  <rect className="outline" x={hover.x} y={hover.y} width={hover.w} height={hover.h} />
                  <text className="span-label" x={hover.x + hover.w / 2} y={mid}>{formatMm(hover.w)} mm</text>
                  <text className="span-label" x={mid} y={hover.y + hover.h / 2}
                    transform={`rotate(-90 ${mid} ${hover.y + hover.h / 2})`}>{formatMm(hover.h)} mm</text>
                  <g className="tag" transform={`translate(${hover.x + hover.w / 2} ${hover.y + hover.h - 6})`}>
                    <rect x={-15} y={-3.6} width={30} height={7.2} rx={1.5} />
                    <text y={-1.3}>{size?.name}</text>
                    <text y={1.9} className="dim">{formatMm(hover.w)} × {formatMm(hover.h)} mm</text>
                  </g>
                </g>
              )}
            </svg>
          </div>
          <div className="editor-bar">
            {sheets.length > 1 && (
              <>
                <button type="button" disabled={index === 0}
                  onClick={() => dispatch(viewerOpened(index - 1))}>‹ 上一張</button>
                <button type="button" disabled={index === sheets.length - 1}
                  onClick={() => dispatch(viewerOpened(index + 1))}>下一張 ›</button>
              </>
            )}
            <span className="spacer" />
            <button type="button" className="primary" onClick={close}>關閉</button>
          </div>
        </>
      )}
    </dialog>
  );
}
