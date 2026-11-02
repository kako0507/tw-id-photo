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
const THUMB_W = 175;    // Card thumbnail canvas width in px (height follows the 2in ratio)
const ROW_THUMB_H = 96; // Per-size thumbnail canvas height in px (width follows the size ratio)

// The canvas is a projection of state: redraw when the crop changes
function CropCanvas({ id, sizeId, crop, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const source = getImage(id);
    const canvas = ref.current;
    if (!source || !crop || !canvas) return;
    const size = SIZE_BY_ID[sizeId];
    canvas.height = height;
    canvas.width = Math.round((height * size.w) / size.h);
    drawCrop(canvas.getContext("2d"), source, crop, size, 0, 0, canvas.width, canvas.height);
  }, [id, sizeId, crop, height]);
  return <canvas ref={ref} />;
}

const STATUS_TEXT = { decoding: "讀取中…", detecting: "偵測人臉中…" };

export default function PhotoCard({ id }) {
  const photo = useSelector((state) => selectById(state, id));
  // Boolean result, so the selector never returns a fresh object
  const padded = useSelector((state) =>
    SIZES.some((s) => (selectById(state, id)?.counts[s.id] || 0) > 0 && selectPadded(state, id, s.id)));
  const dispatch = useDispatch();
  const ready = photo.status === "ready";
  const thumbH = Math.round((THUMB_W * SIZE_BY_ID[THUMB_ID].h) / SIZE_BY_ID[THUMB_ID].w);

  const status = STATUS_TEXT[photo.status];

  return (
    <div className="card">
      <div className="card-head">
        {ready ? <CropCanvas id={id} sizeId={THUMB_ID} crop={photo.crops[THUMB_ID]} height={thumbH} />
          : <div className="thumb-empty" />}
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
              <button type="button" className="size-thumb" title={`調整${size.name}裁切`}
                aria-label={`調整${size.name}裁切`} onClick={() => dispatch(openEditor(id, size.id))}>
                <CropCanvas id={id} sizeId={size.id} crop={photo.crops[size.id]} height={ROW_THUMB_H} />
              </button>
              <span className="size-label">
                <strong>{size.name}</strong>
                <small>{size.use}</small>
              </span>
              <input type="number" min={0} max={20} value={photo.counts[size.id] || 0}
                aria-label={`${size.name} 張數`}
                onChange={(e) => dispatch(countChanged({ id, sizeId: size.id, count: e.target.value }))} />
              <button type="button" onClick={() => dispatch(openEditor(id, size.id))}>✂️ 調整裁切</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
