import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectPieceCount, selectSheets } from "../store/selectors.js";
import { clearAll, downloadSheets } from "../store/thunks.js";

export default function Toolbar() {
  const photoCount = useSelector((state) => state.photos.ids.length);
  const sheetCount = useSelector((state) => selectSheets(state).length);
  const pieceCount = useSelector(selectPieceCount);
  const dispatch = useDispatch();
  const [exporting, setExporting] = useState(false);  // Button feedback only, not app state

  const onDownload = async () => {
    setExporting(true);
    try {
      await dispatch(downloadSheets());
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <span className="count">
          {photoCount ? `共 ${photoCount} 張照片，${pieceCount} 張證件照，${sheetCount} 張 4×6` : "尚未加入照片"}
        </span>
        <div className="actions">
          <button type="button" disabled={!photoCount} onClick={() => dispatch(clearAll())}>清除全部</button>
          <button type="button" className="primary" disabled={!sheetCount || exporting} onClick={onDownload}>
            {exporting ? "匯出中…" : "全部下載"}
          </button>
        </div>
      </div>
      <p className="print-hint">沖印時請選 4×6，不要勾選裁切或填滿</p>
    </>
  );
}
