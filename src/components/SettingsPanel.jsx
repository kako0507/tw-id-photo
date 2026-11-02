import { useDispatch, useSelector } from "react-redux";
import { settingChanged, settingsReset } from "../store/settingsSlice.js";

function MmRange({ id, label, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label} <output>{value} mm</output></label>
      <input type="range" id={id} min={0} max={10} step={0.5} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function SettingsPanel() {
  const s = useSelector((state) => state.settings);
  const dispatch = useDispatch();
  const set = (key) => (value) => dispatch(settingChanged({ key, value }));

  return (
    <aside className="panel settings" aria-label="設定">
      <MmRange id="marginMm" label="邊界" value={s.marginMm} onChange={set("marginMm")} />
      <MmRange id="gapMm" label="間距" value={s.gapMm} onChange={set("gapMm")} />
      <div className="field check">
        <label>
          <input type="checkbox" checked={s.cutLines} onChange={(e) => set("cutLines")(e.target.checked)} />
          裁切線
        </label>
      </div>
      <button type="button" onClick={() => dispatch(settingsReset())}>重設</button>
    </aside>
  );
}
