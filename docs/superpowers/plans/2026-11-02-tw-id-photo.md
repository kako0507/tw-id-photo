# tw-id-photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app that auto-crops ID photos from a portrait using face landmarks and packs them onto 4×6 inch sheets exported as 300 DPI JPGs.

**Architecture:** React + Redux Toolkit with three slices (`settings`, `photos`, `editor`); pixels and the MediaPipe instance live outside the store in `imageCache` / module scope. Pure geometry modules (`sizes`, `crop`, `headTop`, `layout`) carry the logic and are unit-tested; thunks wire decoding, detection and export. Sheets are derived by a memoized selector, never stored.

**Tech Stack:** React 19, Redux Toolkit 2, react-redux 9, Vite 8, Vitest 5 (+jsdom for persistence), Playwright 1.64, `@mediapipe/tasks-vision` (latest at install time, pinned exactly), heic2any 0.0.4 (lazy).

**Spec:** `docs/superpowers/specs/2026-11-02-tw-id-photo-design.md`

**Reference project:** `D:\Projects\tw-id-watermark` — copy its patterns (vite `seoFiles` plugin, `decode.js`, `persistence.js`, `imageCache` idea, editor history, deploy workflow, README layout) rather than reinventing them.

## Global Constraints

- Redux three principles: one store; serializable state only (no File/ImageBitmap/canvas in state); side effects only in thunks.
- Code comments in English; UI text in Traditional Chinese.
- Photos never leave the device. Only the MediaPipe wasm (jsDelivr, same version as the npm package) and model (`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`) are fetched.
- Sheet: 4×6 in = 152.4 × 101.6 mm; output 300 DPI → 1800×1200 (landscape) or 1200×1800 (portrait), JPEG quality 0.95, white background.
- Defaults: `marginMm: 3`, `gapMm: 2`, `cutLines: true`, `dpi: 300`; new photo counts `{ "2in": 4, "1in": 4 }`; `HISTORY_LIMIT = 50`; editor rotation ±15°.
- Output file names `證件照-4x6-1.jpg`, `證件照-4x6-2.jpg`, …
- git user Tim Kuo <kako0507@gmail.com>; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; subjects don't mention React/Redux.
- User photos are never committed; only `e2e/fixtures/sample-2in.jpg` (official ID sample, Git LFS).

## Review Focus

1. **Phone photos (12 MP, EXIF-rotated, HEIC)** — must decode upright and detect in reasonable time. Detection runs on a copy downscaled to max 1280 px long side and scales features back (Task 5 test `scales features back to the source`).
2. **Head touching or cut by the top edge** — head-top scan must fall back instead of returning 0, and the crop is reported padded (Task 4 test `falls back when the head reaches the top`, Task 3 test `reports padding`).
3. **Re-detection after a manual edit** — must not overwrite the user's crop for that size (Task 7 test `keeps manual crops on re-detection`).
4. **Many copies / zero copies** — overflow starts new sheets; all-zero counts give no sheets and a disabled download (Task 2 tests `starts a new sheet`, `returns no sheets`; Task 7 selector test).
5. **Model fails to load (offline)** — every photo still gets a centered crop and a visible message (Task 8 test `falls back to centered crops when the model fails`).

---

### Task 1: Scaffold and size table

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html` (minimal head + `#root`; SEO filled in Task 11), `.gitignore`, `.gitattributes`, `src/main.jsx`, `src/App.jsx` (placeholder heading), `src/styles.css` (copy tokens/dark mode from reference)
- Create: `src/lib/sizes.js`
- Test: `src/lib/sizes.test.js`

**Interfaces:**
- Produces:
  - `SIZES: Array<{ id, name, use, w, h, headMm, headRange: [min,max], topMm?, eyeFromBottomMm?, eyeRange? }>` in this order: `2in`, `1in`, `2in-half`, `us-visa`, values exactly as spec §2 (`us-visa`: `eyeFromBottomMm: 31.5`, `eyeRange: [28, 35]`, no `topMm`).
  - `SIZE_BY_ID: Record<string, Size>`, `DEFAULT_COUNTS = { "2in": 4, "1in": 4 }`, `SHEET_MM = [152.4, 101.6]`.

- [ ] **Step 1:** `git lfs install`; `.gitattributes` = `e2e/fixtures/**/*.jpg filter=lfs diff=lfs merge=lfs -text`; `.gitignore` same as reference. `package.json` scripts/devDependencies same as reference (name `tw-id-photo`, no jspdf); add `@mediapipe/tasks-vision` with an exact version. `npm install`.
- [ ] **Step 2: Write failing test** `sizes.test.js`:
  - `every size has its target head inside its range` — `headRange[0] <= headMm <= headRange[1]`.
  - `every size positions the head` — exactly one of `topMm` / `eyeFromBottomMm` is a number.
  - `head fits inside the photo` — `(topMm ?? 0) + headRange[1] < h`.
  - `default counts refer to real sizes` — every key of `DEFAULT_COUNTS` is in `SIZE_BY_ID`.
- [ ] **Step 3:** Run `npx vitest run src/lib/sizes.test.js` → FAIL (module missing).
- [ ] **Step 4:** Implement `src/lib/sizes.js`; copy `vite.config.js` from reference (seoFiles plugin unchanged, `test.include` same).
- [ ] **Step 5:** `npx vitest run` → PASS; `npx vite build` succeeds.
- [ ] **Step 6:** Commit "Scaffold the project and the photo size table".

### Task 2: Sheet layout

**Files:** Create `src/lib/layout.js`; Test `src/lib/layout.test.js`

**Interfaces:**
- Produces: `layoutSheets(pieces: Array<{ key, w, h }>, { marginMm, gapMm }) → Array<{ orientation: "landscape"|"portrait", w, h, items: Array<{ key, x, y, w, h }> }>` (mm, origin top-left of the sheet). Throws `Error("照片太大，放不進 4×6 相紙")` if one piece doesn't fit either orientation.

Algorithm: sort pieces by `h` desc (stable), shelf-pack into a sheet of usable size `(W-2m) × (H-2m)` with `gap` between items and shelves; open a new sheet when a shelf doesn't fit. Run once with landscape (152.4×101.6) and once with portrait (101.6×152.4) — the orientation is chosen per whole run; keep the run with fewer sheets, landscape on ties. Pieces are never rotated.

- [ ] **Step 1: Write failing tests:**
  - `fits eight 2-inch photos on one landscape sheet` — 8×(35×45) → 1 sheet, `orientation: "landscape"`.
  - `fits twelve 1-inch photos on one portrait sheet` — 12×(28×35) → 1 sheet, `"portrait"`.
  - `fits four 2-inch and four 1-inch on one sheet`.
  - `starts a new sheet when full` — 9×(35×45) → 2 sheets, `[8, 1]` items.
  - `keeps every item inside the margins and apart` — mixed 20 pieces of all four sizes: each item within `[m, W-m]×[m, H-m]`, no two items overlap (with `gap` between).
  - `returns no sheets for no pieces` — `[]` → `[]`.
  - `rejects a piece larger than the sheet` — 200×200 throws.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit "Pack photos onto 4x6 sheets".

### Task 3: Crop geometry

**Files:** Create `src/lib/crop.js`; Test `src/lib/crop.test.js`

**Interfaces:**
- Consumes: `Size` from Task 1.
- Produces (all coordinates in source-image pixels; `crop = { cx, cy, pxPerMm, angle }` where `(cx, cy)` is the crop center and `angle` (radians) is the face tilt; the spec's "rotated coordinates" are realized by carrying `angle` on the crop):
  - `autoCrop(features: { leftEye, rightEye, headTop, chin, angle }, size) → crop`
  - `centeredCrop(width, height, size) → crop` — largest crop of the size's aspect centered in the image, `angle: 0`.
  - `cropCorners(crop, size) → [{x,y}×4]` (TL, TR, BR, BL).
  - `isPadded(crop, size, width, height) → boolean` — any corner outside the image.
  - `guideBands(size) → { headTop?: [mmFromTop, mmFromTop], chin?: [..], eye?: [..] }` — `headTop = [max(0, topMm-2), topMm+2]`, `chin = [topMm+headRange[0], topMm+headRange[1]]`; for `us-visa` only `eye = [h-eyeRange[1], h-eyeRange[0]]`.

autoCrop math: `d = (-sin a, cos a)` is "down the face"; `headPx = dot(chin - headTop, d)`; `pxPerMm = headPx / headMm`. Across the face the center follows the eye midpoint `E`. Along `d`: general sizes put `headTop` at `topMm` from the top edge, so `center = headTop + d·(h/2 - topMm)·pxPerMm` projected onto the across-axis through `E`; `us-visa` puts the eye line `eyeFromBottomMm` above the bottom edge, so `center = E + d·(eyeFromBottomMm - h/2)·pxPerMm`.

- [ ] **Step 1: Write failing tests** with an upright synthetic face (`headTop (500,100)`, `chin (500,580)`, eyes `(440,300)`/`(560,300)`, `angle 0`):
  - `scales the head to the target height` — for each non-visa size, `480 / crop.pxPerMm ≈ headMm` (±0.01).
  - `puts the head top topMm below the top edge` — `cropCorners(crop)[0].y` equals `100 - topMm·pxPerMm` (±0.5 px).
  - `centers on the eyes` — `cx ≈ 500`.
  - `puts the US visa eye line 31.5 mm above the bottom edge`.
  - `follows a tilted face` — rotate the whole synthetic face 10° about (500,300): `crop.angle ≈ 10°`, head height still `headMm`.
  - `reports padding` — a face with `headTop.y = 5` in a 1000×1000 image is padded; the upright face above is not.
  - `centeredCrop fills the image height or width` — 1000×2000 image, `2in` crop: width spans 1000 px.
  - `guide bands` — `2in`: headTop `[2,6]`, chin `[36,40]`; `us-visa`: eye `[15,22]` and no chin band.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit "Compute ID photo crops from face features".

### Task 4: Head-top scan

**Files:** Create `src/lib/headTop.js`; Test `src/lib/headTop.test.js`

**Interfaces:**
- Produces: `findHeadTop({ data, width, height }, { x, y, halfWidth }, fallbackY) → { y, found }` — scans rows upward from `y` (the forehead) over columns `x ± halfWidth`; `HEAD_TOP_FALLBACK = 0.35` exported for the caller (`fallbackY = forehead.y - 0.35·(chin.y - forehead.y)`).

Background color = median of the top 5% rows × outer 5% columns on both sides. A pixel differs if its RGB distance > 40. A row is background when < 10% of its pixels differ; the head top is the row just below the first run of 3 consecutive background rows. If the scan reaches row 0 without such a run → `{ y: max(0, fallbackY), found: false }`.

- [ ] **Step 1: Write failing tests** on synthetic RGBA buffers (helper builds a plain background + filled dark ellipse "head"):
  - `finds the top of a dark head on a white background` — ellipse top at y=120 → `y` within ±1, `found: true`.
  - `works on a light grey background` — background (200,200,200), hair (60,40,30).
  - `ignores a thin dark line beside the head` — 1 px line at y=60 from x=head+40 to the right edge (like the sample's guide line) outside `x ± halfWidth` → still 120.
  - `falls back when the head reaches the top` — ellipse top at y=-20 → `found: false`, `y === fallbackY`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit "Find the top of the head from the background".

### Task 5: Face landmarks (MediaPipe)

**Files:** Create `src/lib/face.js`; Test `src/lib/face.test.js`

**Interfaces:**
- Produces:
  - `featuresFromLandmarks(landmarks: Array<{x,y}> (normalized), width, height, scale = 1) → { leftEye, rightEye, forehead, chin, angle }` — image-left eye is `leftEye`; eyes from iris centers 468 and 473, forehead 10, chin 152; coordinates multiplied by `width`/`height` then divided by `scale` (to map a downscaled detection back to the source); `angle = atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)`.
  - `async detectFace(source: ImageBitmap|HTMLCanvasElement) → features | null` — downscales to max 1280 px long side on a canvas, runs Face Landmarker (IMAGE mode, `numFaces: 1`), returns `featuresFromLandmarks(...)`. In DEV, if `window.__faceStub` is a function, returns `window.__faceStub(source)` instead (e2e hook).
  - `async loadFaceLandmarker()` — memoized promise; rejects on network failure.

- [ ] **Step 1: Write failing tests:**
  - `maps normalized landmarks to pixels` — 1000×800 image, landmark 10 at (0.5,0.1) → forehead (500,80).
  - `orders eyes left to right` — swap 468/473 positions → `leftEye.x < rightEye.x`.
  - `computes the eye-line angle` — eyes (0.4,0.5)/(0.6,0.52) on 1000×1000 → `atan2(20,200)`.
  - `scales features back to the source` — `scale = 0.5` doubles coordinates.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (`FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<pinned>/wasm")`, read the version from `package.json` via import so they never drift). **Step 4:** PASS. **Step 5:** Commit "Detect face landmarks locally with MediaPipe".

### Task 6: Rendering crops and sheets

**Files:** Create `src/lib/decode.js` (copy from reference), `src/lib/imageCache.js`, `src/lib/render.js`; Test `src/lib/render.test.js`

**Interfaces:**
- Produces:
  - `imageCache`: `setImage(id, bitmap)`, `getImage(id)`, `removeImage(id)`, `clearImages()`.
  - `mmToPx(mm, dpi) → number` (`mm / 25.4 * dpi`).
  - `sheetPixelSize(sheet, dpi) → [w, h]` — rounds; landscape 300 DPI → `[1800, 1200]`.
  - `drawCrop(ctx, source, crop, size, x, y, w, h)` — draws the rotated crop into the target rect, white where outside the source.
  - `renderSheet(sheet, getPiece: key → { source, crop, size }, settings) → HTMLCanvasElement` — white fill, every item via `drawCrop`, `0.1 mm` `#bbbbbb` rectangle per item when `settings.cutLines`.
  - `sheetFileName(index) → "證件照-4x6-${index + 1}.jpg"`.
  - `canvasToJpeg(canvas) → Promise<Blob>` (quality 0.95), `triggerDownload(blob, name)` (copy from reference `watermark.js`).
- [ ] **Step 1: Write failing tests** for the pure functions: `mmToPx(25.4, 300) === 300`; `sheetPixelSize` landscape `[1800,1200]`, portrait `[1200,1800]`; `sheetFileName(0) === "證件照-4x6-1.jpg"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (canvas functions are covered by e2e). **Step 4:** PASS. **Step 5:** Commit "Render crops onto 300 DPI sheets".

### Task 7: Store

**Files:** Create `src/store/settingsSlice.js`, `src/store/persistence.js` (pattern from reference, key `tw-id-photo-settings`), `src/store/photosSlice.js`, `src/store/editorSlice.js`, `src/store/selectors.js`, `src/store/index.js` (`createAppStore(preloadedSettings)`); Tests `src/store/*.test.js`

**Interfaces:**
- Consumes: `autoCrop`, `centeredCrop` (Task 3), `SIZES`, `DEFAULT_COUNTS` (Task 1), `layoutSheets` (Task 2).
- Produces:
  - settings: `DEFAULT_SETTINGS`, `settingChanged({ key, value })`, `settingsReset()`.
  - photos (entity adapter): item `{ id, name, status, error, width, height, features, crops, manual, counts }` as spec §5 (no stored `padded` — derived by `selectPadded`). Actions: `photoAdded({ id, name })` (status `"decoding"`, counts `DEFAULT_COUNTS`), `photoDecoded({ id, width, height })` (→ `"detecting"`), `photoDetected({ id, features, error? })` (→ `"ready"`; for every size not in `manual`: `autoCrop` when `features`, else `centeredCrop`; stores `error` message when given), `photoFailed({ id, error })`, `countChanged({ id, sizeId, count })` (clamped 0–20 integer), `photoRemoved(id)`, `photosCleared()`; handles `editorApplied` (sets crop + `manual[sizeId] = true`).
  - editor: state `{ photoId, sizeId, crop, past, future }`; `editorOpened({ photoId, sizeId, crop })`, `editStarted()` (push current crop to `past`, cap `HISTORY_LIMIT`, clear `future`), `cropChanged(crop)`, `editorUndone()`, `editorRedone()`, `editorAutoCropped(crop)` (records history), `editorApplied({ photoId, sizeId, crop })`, `editorClosed()`.
  - selectors: `selectSheets(state)` (memoized; pieces from ready photos in `SIZES` order, key `${id}:${sizeId}:${n}`, then `layoutSheets`), `selectPiece(state, key) → { photoId, sizeId, crop }`, `selectPadded(state, id, sizeId) → boolean`, `selectPieceCount(state)`.

- [ ] **Step 1: Write failing tests:**
  - photos: `starts with the default counts`; `crops every size after detection`; `uses centered crops when no face was found` (and keeps `error`); `keeps manual crops on re-detection`; `clamps counts to 0–20`.
  - editor: `undo and redo restore crops`; `caps history at HISTORY_LIMIT`; `a new edit clears redo`.
  - persistence (jsdom): `ignores bad stored values`; `URL parameters override stored settings` (`?gapMm=4`).
  - selectors: `lays out every copy` (one photo, default counts → 1 sheet, 8 items); `returns no sheets when all counts are zero`; `skips photos that are not ready`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run` → PASS. **Step 5:** Commit "Add the store for photos, sheets and the crop editor".

### Task 8: Thunks

**Files:** Create `src/store/thunks.js`; Test `src/store/thunks.test.js` (mock `decode.js`, `face.js`, `headTop.js`, `render.js`)

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces: `addFiles(files)`, `detectPhoto(id)`, `removePhoto(id)`, `clearAll()`, `openEditor(photoId, sizeId)`, `autoCropInEditor()`, `applyEditor()`, `downloadSheets()`.
  - `detectPhoto`: `detectFace(image)`; if features, sample pixels around the forehead (draw source to a canvas, `getImageData`), `findHeadTop(...)` with `fallbackY` from `HEAD_TOP_FALLBACK`, then `photoDetected({ id, features: { ...f, headTop: { x: forehead.x, y } } })`. No face → `photoDetected({ id, features: null, error: "沒找到臉，請手動裁切" })`. Model load failure → `photoDetected({ id, features: null, error: "人臉偵測載入失敗，請手動裁切" })`.
  - `downloadSheets`: for each `selectSheets` sheet, `renderSheet` → `canvasToJpeg` → `triggerDownload(sheetFileName(i))`, sequentially.
- [ ] **Step 1: Write failing tests:** `adds, decodes and detects each file`; `marks undecodable files as errors`; `falls back to centered crops when the model fails`; `uses the head-top scan result`; `downloads one file per sheet`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit "Wire decoding, detection and sheet export".

### Task 9: Main UI

**Files:** Create `src/components/DropZone.jsx`, `SettingsPanel.jsx`, `PhotoList.jsx`, `PhotoCard.jsx`, `SheetPreview.jsx`, `Toolbar.jsx`; Modify `src/App.jsx`, `src/main.jsx` (expose `window.__store` in DEV), `src/styles.css`

**Interfaces:** Consumes Tasks 6–8. Layout per spec §8.
- `PhotoCard`: thumbnail of the `2in` crop, status/error text, padded warning "照片邊緣不夠，已補白", one row per size: name + use, number input (`aria-label` `${name} 張數`), button 「調整」.
- `SheetPreview`: one canvas per sheet rendered at 0.25 scale via `renderSheet`; caption 「第 n 張（橫式/直式）」; empty state 「尚未選擇張數」.
- `Toolbar`: 清除全部, 全部下載 (`disabled` when no sheets), hint 「沖印時請選 4×6，不要勾選裁切或填滿」.
- `SettingsPanel`: 邊界 (0–10 mm), 間距 (0–10 mm), 裁切線 checkbox, 重設.

- [ ] **Step 1:** Implement components. **Step 2:** `npm run dev`, load the sample photo by hand, confirm cards, counts and preview update. **Step 3:** `npx vitest run` + `npx vite build` pass. **Step 4:** Commit "Add the photo list, sheet preview and settings".

### Task 10: Crop editor with guides

**Files:** Create `src/components/EditorDialog.jsx`; Modify `src/styles.css`

**Interfaces:** Consumes editor actions (Task 7), `guideBands`, `drawCrop` (Tasks 3, 6), `autoCropInEditor`, `applyEditor` (Task 8).
- Canvas shows the crop at fixed frame size (`size.w : size.h`); pointer drag moves the photo (updates `cx/cy` in source pixels, accounting for `angle`), wheel / pinch zoom changes `pxPerMm` around the frame center, range input 「旋轉」 −15°…15°. Each gesture: `editStarted` on start, `cropChanged` while moving.
- Overlay: vertical center line; translucent bands from `guideBands(size)` labelled 頭頂 / 下巴 / 眼睛.
- Buttons: ↶上一步, ↷下一步 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z), 重新自動裁切, 取消, 套用. `showModal` in `useLayoutEffect` (reference bug fix).
- [ ] **Step 1:** Implement. **Step 2:** Manual check in dev: drag, zoom, rotate, undo/redo, apply updates the preview and survives re-detection. **Step 3:** Commit "Add the crop editor with head guides".

### Task 11: E2E tests and fixture

**Files:** Create `scripts/clean_sample.py` (copy of `C:\Users\2610137\AppData\Local\Temp\claude\C--Users-2610137\9460d743-4c03-4e4b-ae87-9b74a819d246\scratchpad\remove_lines.py`; usage `python scripts/clean_sample.py <original.jpg> <out.jpg>`, needs opencv-python + numpy), `e2e/fixtures/sample-2in.jpg` (copy of `...\scratchpad\sample-clean.jpg`, same folder as above), `e2e/fixtures/sample-2in.json` (`{ "mmPerPx": 0.07495, "headTopY": 30.5, "chinY": 510.5 }`), `playwright.config.js` (reference config, port 5181), `e2e/face.spec.js`, `e2e/sheet.spec.js`

- Also create `e2e/fixtures/ai/halfbody-woman.jpg` + `.json` (copies of `...\scratchpad\ai-halfbody-woman.jpg/.json`; Gemini-generated fictional person, 2816×1536, `headTopY: 160`, `chinY: 920`, measured by hand from zoomed crops). More AI photos go in the same folder with the same JSON shape; the spec loops over every `.json` there.
- `face.spec.js` (real MediaPipe, needs network):
  - `finds the head top and chin on the sample` — via `window.__store`: after detection, `|headTop.y - 30.5|` and `|chin.y - 510.5|` each `< 13.3` px (1 mm).
  - `finds the head top and chin on every AI photo` — each within 2% of the answer key's head height (`chinY − headTopY`).
  - `crops every size within the rules on every AI photo` — for each size: head height in mm (`(chin−headTop along the face axis)/pxPerMm`) inside `headRange`; head top inside the `headTop` guide band (non-visa) or eye line inside the `eye` band (visa); `selectPadded` is false.
  - `marks the tight sample as padded for the larger sizes` — on `sample-2in.jpg` as uploaded, `selectPadded` is true for `1in`, `2in-half`, `us-visa`.
  - `auto crop keeps the 2-inch head within 32–36 mm on a rotated, enlarged sample` — the test builds (in the page) a 1400×1800 canvas, white fill, sample scaled ×2 and rotated 5°, uploads it as PNG; resulting crop: `(chin−headTop along the face axis)/pxPerMm` ∈ [32, 36] and `crop.angle` ≈ 5° (±1°).
  - optional `E2E_PHOTOS_DIR` test (skipped if unset): every photo's 2-inch head height ∈ [32, 36].
- `sheet.spec.js` (stub): `addInitScript` sets `window.__faceStub` returning fixed features for any image; upload the sample, set 1 吋 to 8 → two sheets; click 全部下載; downloads named `證件照-4x6-1.jpg` / `-2.jpg`; decode each in the page → `1800×1200` or `1200×1800`; pixel at the first item's center is not white, at the sheet margin is white.
- [ ] **Step 1:** Write specs. **Step 2:** `npm run test:e2e` → PASS. **Step 3:** `git lfs ls-files` lists `sample-2in.jpg`. **Step 4:** Commit "Add end-to-end tests with the ID sample photo".

### Task 12: SEO, README, deployment

**Files:** Modify `index.html`; Create `public/favicon.svg`, `public/og-image.png` (1200×630, generated), `README.md`, `.github/workflows/deploy.yml` (copy reference; same steps incl. `lfs: true`, unit + e2e before build)

- `index.html`: title 「證件照排版｜4×6 相紙自動排版、免費、無廣告、照片不上傳｜2 吋、1 吋、美簽」; description/keywords/OG/Twitter/canonical as reference with this app's wording; JSON-LD `WebApplication` (featureList: 免費無廣告、照片只在本機處理、自動偵測臉部裁切、2 吋/1 吋/半身/美簽、多人多尺寸混排、輸出 300 DPI 4×6 JPG) and `FAQPage`; static how-to + FAQ (要付費嗎、照片會上傳嗎、支援哪些尺寸、怎麼沖印、可以換白底嗎（不行，請在白牆前拍）).
- README: user section (features, usage, 沖印注意, FAQ) → 「⚠️ 以下是技術說明」 → stack, commands, tests/LFS, deploy, project structure.
- [ ] **Step 1:** Write files. **Step 2:** `npm test`, `npm run test:e2e`, `npx vite build` pass; built `dist/index.html` has no `__SITE_URL__`. **Step 3:** Commit "Add SEO metadata, README and the Pages workflow".
- [ ] **Step 4 (needs the user):** create `~/.ssh/tw-id-photo_ed25519`, add the `github-tw-id-photo` host alias; the user adds the public key and creates the empty `kako0507/tw-id-photo` repo, sets Pages Source = GitHub Actions; then add remote `github-tw-id-photo:kako0507/tw-id-photo.git` and push only when the user says so.
