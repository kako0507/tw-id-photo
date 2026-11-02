import { useSelector } from "react-redux";
import PhotoCard from "./PhotoCard.jsx";

export default function PhotoList() {
  const ids = useSelector((state) => state.photos.ids);
  return (
    <div className="list">
      {ids.map((id) => <PhotoCard key={id} id={id} />)}
    </div>
  );
}
