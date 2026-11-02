# 證件照排版

把照片自動裁成台灣證件照尺寸，排進 4×6 相紙，輸出 300 DPI 的 JPG 拿去沖印。

**完全免費、沒有廣告、不用註冊。照片只在你的裝置上處理，不會上傳到網路。**

## 可以做什麼

- **自動偵測臉部裁切：** 依規格的頭頂到下巴比例自動裁切，也可以手動拖曳、縮放、旋轉，畫面上有頭頂、下巴、眼睛參考線。
- **常用尺寸：**
  - 2 吋 3.5×4.5 cm（身分證、護照、健保卡、台胞證）
  - 1 吋 2.8×3.5 cm（駕照、體健表、身心障礙證明）
  - 2 吋半身 4.2×4.7 cm（學生證、履歷、證書執照）
  - 美國簽證 5×5 cm
- **多人多尺寸混排：** 一次選多張照片，每張各自設定尺寸與張數，排在同一張 4×6 相紙上，張數多會自動分頁。
- **輸出 4×6 吋 JPG：** 300 DPI（1800×1200），附裁切線，下載後直接沖印。

## 怎麼使用

1. 打開網頁，點上方區塊選擇照片，或直接把照片拖進來。
2. 程式會自動偵測臉部並裁切。
3. 選擇每張照片要印的尺寸與張數。
4. 裁得不準時按「調整」，對齊頭頂、下巴、眼睛參考線。
5. 確認相紙預覽後下載 JPG。

## 沖印注意

- 沖印時紙張選 **4×6**，**不要勾選裁切或填滿**，否則尺寸會被改掉。
- 這個工具**不能換白底**，請在白牆或素色淺色背景前拍照。
- 照片請正對鏡頭，臉部不要被頭髮或陰影遮住。

## 常見問題

**需要付費嗎？有廣告嗎？**
完全免費，沒有廣告，也不用註冊或登入。

**照片會上傳到網路嗎？**
不會。照片只在你的裝置上處理。人臉偵測模型會從網路下載，但在你的瀏覽器裡執行，照片不會傳到任何伺服器，也不會被保存。

**支援哪些尺寸？**
2 吋、1 吋、2 吋半身、美國簽證，可以在同一張相紙混排。

**可以換白底嗎？**
不行，請在白牆或素色淺色背景前拍。

**為什麼第一次偵測比較慢？**
第一次要先下載人臉偵測模型，之後瀏覽器會記住，就會變快。

---

> ⚠️ **以下是技術說明，給要修改或部署這個專案的開發者看。只是要使用的話，看到這裡就可以了。**

---

## 技術架構

React 19 + Redux Toolkit + React-Redux，用 Vite 打包，部署在 GitHub Pages。

- 人臉偵測用 MediaPipe Face Landmarker：wasm 從 jsDelivr 載入（版本與 npm 套件相同），模型從 `storage.googleapis.com/mediapipe-models` 下載，都在第一次偵測時才載入，偵測在瀏覽器裡執行。
- HEIC 轉換用 heic2any，遇到 HEIC 檔才載入。
- 照片像素放在 `imageCache`，不放進 Redux store，store 只存可序列化的資料。

## 開發

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # 輸出到 dist/
npm run preview   # 預覽 build 結果
npm test          # 執行單元測試 (Vitest)
npm run test:e2e  # 執行 e2e 測試 (Playwright)
```

### e2e 測試

- e2e 測試用的照片放在 `e2e/fixtures/`（`sample-2in.jpg` 與 `ai/*`），用 **Git LFS** 儲存。clone 之前先安裝 [Git LFS](https://git-lfs.com/) 並執行 `git lfs install`；已經 clone 的話執行 `git lfs pull`。
- 第一次執行要先下載瀏覽器：`npx playwright install chromium`。
- 想用自己的真實照片驗證頭高是否在 2 吋規格內（32–36 mm）時，把照片放在專案**以外**的資料夾，再設定 `E2E_PHOTOS_DIR`：

  ```bash
  E2E_PHOTOS_DIR=/path/to/photos npm run test:e2e
  ```

  真實照片含有個資，**不要放進這個 repo**；沒設定時這個測試會自動略過。
- `scripts/clean_sample.py` 用來從原始樣本照片移除頭頂與下巴的細參考線，產生 `e2e/fixtures/sample-2in.jpg`：

  ```bash
  pip install opencv-python numpy
  python scripts/clean_sample.py <original.jpg> <out.jpg>
  ```

## 部署到 GitHub Pages

1. 把專案推到 GitHub repo 的 `main` 分支。
2. 到 repo 的 Settings → Pages，Source 選 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 會先跑單元測試與 e2e 測試，通過後才 build 並部署。網站網址會自動帶入 canonical、`og:url`、`robots.txt` 和 `sitemap.xml`。
4. 想用 Google Search Console 驗證網站時，在 repo 的 Settings → Secrets and variables → Actions → Variables 新增 `GOOGLE_SITE_VERIFICATION`（選用），build 時會自動加進 `<meta name="google-site-verification">`。

## 專案結構

```
index.html               SEO 標籤、結構化資料、靜態使用說明與常見問題
public/                  favicon.svg、og-image.png
scripts/
  clean_sample.py        清除樣本照片上的參考線
e2e/                     Playwright 測試與 Git LFS 測試照片
src/
  main.jsx               建立 store、掛上 React
  App.jsx
  components/            React 元件 (只讀 state、dispatch action)
  store/
    index.js             configureStore
    settingsSlice.js     相紙與尺寸設定
    photosSlice.js       照片清單與裁切
    editorSlice.js       調整視窗與復原紀錄
    selectors.js
    thunks.js            所有副作用 (讀檔、偵測、下載)
    persistence.js       設定的讀取與儲存
  lib/                   與 Redux 無關的純邏輯
    sizes.js             證件尺寸
    face.js              人臉偵測
    headTop.js           頭頂位置估計
    crop.js              裁切計算
    layout.js            相紙排版
    render.js            畫出相紙、輸出 JPG
    decode.js            讀取圖片 (含 HEIC)
    imageCache.js        圖片像素快取 (不放進 Redux store)
```
