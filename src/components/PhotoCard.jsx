import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getImage } from "../lib/imageCache.js";
import { drawCrop } from "../lib/render.js";
import { SIZES, SIZE_BY_ID } from "../lib/sizes.js";
import { countChanged, photosAdapter } from "../store/photosSlice.js";
import { selectPadded } from "../store/selectors.js";
import { openEditor, removePhoto } from "../store/thunks.js";

const { selectById } = photosAdapter.getSelectors((state) => state.photos);
const THUMB_ID = "2in";
const THUMB_W = 175; // Thumbnail canvas width in px (height follows the 2in ratio)

const STATUS_TEXT = { decoding: "讀取中…", detecting: "偵測人臉中…" };

export default function PhotoCard({ id }) {
  const photo = useSelector((state) => selectById(state, id));
  // Boolean result, so the selector never returns a fresh object
  const padded = useSelector((state) =>
    SIZES.some((s) => (selectById(state, id)?.counts[s.id] || 0) > 0 && selectPadded(state, id, s.id)));
  const dispatch = useDispatch();
  const canvasRef = useRef(null);
  const ready = photo.status === "ready";
  const crop = photo.crops[THUMB_ID];

  // The canvas is a projection of state: redraw when the crop changes
  useEffect(() => {
    const source = getImage(id);
    const canvas = canvasRef.current;
    if (!ready || !source || !crop || !canvas) return;
    const size = SIZE_BY_ID[THUMB_ID];
    canvas.width = THUMB_W;
    canvas.height = Math.round((THUMB_W * size.h) / size.w);
    drawCrop(canvas.getContext("2d"), source, crop, size, 0, 0, canvas.width, canvas.height);
  }, [id, ready, crop]);

  const status = STATUS_TEXT[photo.status];

  return (
    <div className="card">
      <div className="card-head">
        {ready ? <canvas ref={canvasRef} /> : <div className="thumb-empty" />}
        <div className="meta">
          <span className="name" title={photo.name}>{photo.name}</span>
          {status && <span className="note">{status}</span>}
          {photo.error && <span className={photo.status === "error" ? "note error" : "note"}>{photo.error}</span>}
          {ready && padded && <span className="note warn">照片邊緣不夠，已補白</span>}
          <button type="button" onClick={() => dispatch(removePhoto(id))}>移除</button>
        </div>
      </div>
      {ready && (
        <ul className="sizes">
          {SIZES.map((size) => (
            <li key={size.id}>
              <span className="size-label">
                <strong>{size.name}</strong>
                <small>{size.use}</small>
              </span>
              <input type="number" min={0} max={20} value={photo.counts[size.id] || 0}
                aria-label={`${size.name} 張數`}
                onChange={(e) => dispatch(countChanged({ id, sizeId: size.id, count: e.target.value }))} />
              <button type="button" onClick={() => dispatch(openEditor(id, size.id))}>調整</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
