import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { guideBands } from "../lib/crop.js";
import { getImage } from "../lib/imageCache.js";
import { drawCrop } from "../lib/render.js";
import { SIZE_BY_ID } from "../lib/sizes.js";
import { cropChanged, editorClosed, editorRedone, editorUndone, editStarted } from "../store/editorSlice.js";
import { applyEditor, autoCropInEditor } from "../store/thunks.js";

const FRAME_W = 320;          // Frame width in CSS px; height follows the size's aspect ratio
const MAX_ANGLE = 15;         // Degrees
const ZOOM_STEP = 1.1;        // Per wheel notch
const ZOOM_RANGE = [0.2, 5];  // pxPerMm limits relative to the value at open
const BAND_LABELS = { headTop: "頭頂", chin: "下巴", eye: "眼睛" };

function drawFrame(canvas, source, crop, size) {
  const dpr = window.devicePixelRatio || 1;
  const w = FRAME_W, h = (FRAME_W * size.h) / size.w;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  drawCrop(ctx, source, crop, size, 0, 0, canvas.width, canvas.height);

  // Guides: mm from the top of the frame -> canvas px
  const mm = canvas.height / size.h;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0a84ff";
  ctx.save();
  ctx.font = `${12 * dpr}px sans-serif`;
  ctx.textBaseline = "top";
  for (const [name, [from, to]] of Object.entries(guideBands(size))) {
    ctx.fillStyle = "rgba(255, 90, 90, 0.25)";
    ctx.fillRect(0, from * mm, canvas.width, (to - from) * mm);
    ctx.fillStyle = "#c00";
    ctx.fillText(BAND_LABELS[name], 4 * dpr, from * mm + 2 * dpr);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = dpr;
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.restore();
}

export default function EditorDialog() {
  const editor = useSelector((state) => state.editor);
  const dispatch = useDispatch();
  const store = useStore();
  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const baseScale = useRef(1);   // pxPerMm when the editor opened, for the zoom limits
  const pointers = useRef(new Map());
  const pinch = useRef(0);       // Last distance between two pointers
  const wheelTimer = useRef(0);
  const recorded = useRef(false); // True once the current gesture has pushed its undo step
  const open = editor.photoId !== null;
  const size = open ? SIZE_BY_ID[editor.sizeId] : null;

  // Layout effect so the dialog is visible and measurable before anything draws
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Forget any gesture state when the dialog closes (Escape / cancel mid-drag)
  useEffect(() => {
    if (open) return;
    pointers.current.clear();
    pinch.current = 0;
    recorded.current = false;
    clearTimeout(wheelTimer.current);
    wheelTimer.current = 0;
  }, [open]);

  useEffect(() => {
    if (open) baseScale.current = store.getState().editor.crop.pxPerMm;
  }, [open, editor.photoId, editor.sizeId, store]);

  useEffect(() => {
    if (!open) return;
    drawFrame(canvasRef.current, getImage(editor.photoId), editor.crop, size);
  }, [open, editor.photoId, editor.crop, size]);

  // Undo / redo end the current gesture so the next edit records a fresh step
  const undo = useCallback(() => { recorded.current = false; dispatch(editorUndone()); }, [dispatch]);
  const redo = useCallback(() => { recorded.current = false; dispatch(editorRedone()); }, [dispatch]);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = redo
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if (key === "y" || (key === "z" && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, undo, redo]);

  // History is recorded lazily: one undo step on the first real change of each gesture
  const change = (crop) => {
    if (!recorded.current) {
      recorded.current = true;
      dispatch(editStarted());
    }
    dispatch(cropChanged(crop));
  };

  const zoomBy = (factor) => {
    const crop = store.getState().editor.crop;
    const base = baseScale.current;
    const pxPerMm = Math.min(Math.max(crop.pxPerMm * factor, base * ZOOM_RANGE[0]), base * ZOOM_RANGE[1]);
    if (pxPerMm !== crop.pxPerMm) change({ ...crop, pxPerMm });
  };

  // Wheel needs a non-passive listener to stop the page scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!open || !canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      // One undo step per burst of wheel events
      if (!wheelTimer.current) recorded.current = false;
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => { wheelTimer.current = 0; recorded.current = false; }, 400);
      // Normalise to pixels (a notch is ~100) so trackpads zoom smoothly; zooming in
      // (deltaY < 0) shows fewer source pixels per mm
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      zoomBy(ZOOM_STEP ** (px / 100));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    if (pointers.current.size === 0) recorded.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0 && d > 0) zoomBy(pinch.current / d);
      pinch.current = d;
      return;
    }
    // The photo follows the pointer, so the crop centre moves the opposite way:
    // source delta = -(dx * right + dy * down) / k, right = (cos a, sin a), down = (-sin a, cos a)
    const crop = store.getState().editor.crop;
    const k = canvasRef.current.getBoundingClientRect().width / (size.w * crop.pxPerMm);
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    const cos = Math.cos(crop.angle), sin = Math.sin(crop.angle);
    if (!dx && !dy) return;
    change({
      ...crop,
      cx: crop.cx - (dx * cos - dy * sin) / k,
      cy: crop.cy - (dx * sin + dy * cos) / k,
    });
  };
  const onPointerUp = (e) => {
    if (canvasRef.current.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    onPointerGone(e);
  };
  // Also runs when capture is lost without an up event
  const onPointerGone = (e) => {
    pointers.current.delete(e.pointerId);
    pinch.current = 0;
    if (pointers.current.size === 0) recorded.current = false;
  };

  const onAngle = (e) => {
    const crop = store.getState().editor.crop;
    change({ ...crop, angle: (Number(e.target.value) * Math.PI) / 180 });
  };

  const angleDeg = open ? Math.round(((editor.crop.angle * 180) / Math.PI) * 10) / 10 : 0;

  return (
    <dialog ref={dialogRef} className="editor" onCancel={(e) => { e.preventDefault(); dispatch(editorClosed()); }}>
      <div className="editor-head">
        <strong>調整裁切{size ? `（${size.name}）` : ""}</strong>
        <span>拖曳移動照片，滾輪或雙指縮放，對齊參考線</span>
      </div>
      <div className="editor-stage">
        <canvas ref={canvasRef} id="cropCanvas"
          style={size ? { width: FRAME_W, height: "auto", aspectRatio: `${size.w} / ${size.h}` } : undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerGone} />
      </div>
      {open && (
        <div className="editor-bar">
          <label className="rotate">旋轉
            <input type="range" min={-MAX_ANGLE} max={MAX_ANGLE} step="0.1" value={angleDeg}
              onPointerDown={() => { recorded.current = false; }}
              onPointerUp={() => { recorded.current = false; }}
              onBlur={() => { recorded.current = false; }}
              onKeyDown={(e) => { if (!e.repeat) recorded.current = false; }}
              onKeyUp={() => { recorded.current = false; }}
              onChange={onAngle} />
            <span>{angleDeg}°</span>
          </label>
          <button type="button" disabled={!editor.past.length} title="上一步（Ctrl+Z）"
            onClick={undo}>↶ 上一步</button>
          <button type="button" disabled={!editor.future.length} title="下一步（Ctrl+Y）"
            onClick={redo}>↷ 下一步</button>
          <button type="button" onClick={() => dispatch(autoCropInEditor())}>重新自動裁切</button>
          <span className="spacer" />
          <button type="button" onClick={() => dispatch(editorClosed())}>取消</button>
          <button type="button" className="primary" onClick={() => dispatch(applyEditor())}>套用</button>
        </div>
      )}
    </dialog>
  );
}
