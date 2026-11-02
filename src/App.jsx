import { useSelector } from "react-redux";
import EditorDialog from "./components/EditorDialog.jsx";
import DropZone from "./components/DropZone.jsx";
import PhotoList from "./components/PhotoList.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import SheetPreview from "./components/SheetPreview.jsx";
import Toolbar from "./components/Toolbar.jsx";

export default function App() {
  const hasPhotos = useSelector((state) => state.photos.ids.length > 0);
  return (
    <div className="layout">
      <SettingsPanel />
      <section aria-label="照片">
        <DropZone />
        <Toolbar />
        {hasPhotos && <PhotoList />}
        <SheetPreview />
      </section>
      <EditorDialog />
    </div>
  );
}
