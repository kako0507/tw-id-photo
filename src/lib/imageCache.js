// Non-serializable image data (ImageBitmap) lives here, outside the Redux store
const images = new Map();

export function setImage(id, bitmap) {
  images.set(id, bitmap);
}

export function getImage(id) {
  return images.get(id);
}

export function removeImage(id) {
  images.delete(id);
}

export function clearImages() {
  images.clear();
}
