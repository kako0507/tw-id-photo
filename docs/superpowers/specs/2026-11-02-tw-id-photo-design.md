# tw-id-photo 設計規格：證件照自動裁切與 4×6 排版

日期：2026-11-02

## 1. 目的

使用者用手機在白牆前自拍或請人拍，丟進網頁，程式自動依證件規格裁切大頭照，再把多張、多種尺寸、多個人的照片排進 4×6 吋相紙，輸出 JPG 拿去超商或相館沖印，省下拍證件照的錢。

- 完全免費、無廣告、不用註冊。
- 照片只在使用者裝置上處理，不上傳。人臉偵測模型從 CDN 下載後在瀏覽器裡執行。
- 部署在 GitHub Pages，有完整 SEO，讓人搜尋「證件照 排版 4x6」找得到。

### 成功標準

1. 正面、白牆背景的照片，不調整就能得到臉部比例符合規格的裁切（頭頂到下巴落在規格範圍內）。
2. 偵測不準時，使用者可以在編輯器裡靠參考線手動對準。
3. 輸出的 4×6 JPG 以「實際大小」沖印後，每張照片尺寸誤差在 ±0.3 mm 內。

### 不做（第一版）

- 去背、換白底。照片需在素色淺色背景拍攝。
- 美肌、調色、服裝替換。
- 4×6 以外的相紙；PDF 輸出。

## 2. 支援尺寸

所有尺寸集中在 `src/lib/sizes.js` 一張表。`headMm` 是頭頂到下巴的目標值，`headRange` 是允許範圍（畫參考線用），`topMm` 是頭頂到照片上緣的目標距離。

| id | 名稱 | 用途 | 寬×高 (mm) | headMm | headRange | 位置規則 |
|---|---|---|---|---|---|---|
| `2in` | 2 吋大頭照 | 身分證、護照、健保卡、台胞證 | 35×45 | 34 | 32–36 | `topMm` 4 |
| `1in` | 1 吋 | 駕照、體健表、身心障礙證明 | 28×35 | 24 | 22–26 | `topMm` 4 |
| `2in-half` | 2 吋半身照 | 學生證、履歷、證書執照 | 42×47 | 24 | 20–28 | `topMm` 5 |
| `us-visa` | 美國簽證 | 美國簽證 | 50×50 | 30 | 25–35 | 眼睛距下緣 31.5 mm（範圍 28–35） |

`1in` 與 `2in-half` 的範圍是估計值；尺寸表是唯一要改的地方。

## 3. 技術選擇

與 tw-id-watermark 相同的基礎：

- React 19 + Redux Toolkit + react-redux，遵守 Redux 三大原則（見第 5 節）。
- Vite、Vitest（單元測試）、Playwright（e2e）。
- HEIC 用 heic2any，延遲載入。
- GitHub Pages 經 GitHub Actions 部署；`VITE_SITE_URL`、`VITE_GOOGLE_SITE_VERIFICATION` 用法同 tw-id-watermark。
- 程式註解用英文。

人臉偵測使用 **MediaPipe Face Landmarker**（`@mediapipe/tasks-vision`，npm 安裝固定版本）：

- wasm 從 jsDelivr 載入對應版本；模型 `face_landmarker.task`（float16，約 3.7 MB）從 Google 官方 storage 載入。
- 第一次需要時才載入（lazy），之後快取在模組內。
- 只用 IMAGE 模式，單一人臉（`numFaces: 1`）。

## 4. 偵測與裁切

### 4.1 臉部特徵（`src/lib/face.js`）

`detectFace(source)` 回傳以原圖像素為座標的特徵，偵測不到時回傳 `null`：

- `leftEye`、`rightEye`：眼睛中心（虹膜 landmark 平均）。
- `forehead`：landmark 10（額頭上緣）。
- `chin`：landmark 152（下巴最低點）。
- `angle`：兩眼連線與水平的夾角（弧度），用來把臉轉正。

### 4.2 頭頂估計（`src/lib/headTop.js`）

MediaPipe 沒有頭髮頂端。做法：

1. 依 `angle` 把影像轉正後，取額頭附近、寬度為兩眼距離 1.5 倍的一段水平帶。
2. 由照片上方四角採樣背景色。
3. 從 `forehead` 往上逐列掃描，計算該列和背景色差異大的像素比例；比例連續數列低於門檻的位置就是頭頂。
4. 找不到（背景太雜或頭頂超出照片）時，退回 `forehead - HEAD_TOP_FALLBACK × (chin - forehead)`，常數 `HEAD_TOP_FALLBACK` 初始值 0.35，用測試照片調整。

此函式只吃 `ImageData` 類的像素陣列，方便用合成影像做單元測試。

### 4.3 裁切計算（`src/lib/crop.js`）

一個裁切以「轉正後的影像座標」描述：`{ cx, cy, pxPerMm, angle }`，`(cx, cy)` 是裁切中心，`pxPerMm` 決定縮放。

`autoCrop(features, size)`：

1. `headPx = chinY - headTopY`，`pxPerMm = headPx / size.headMm`。
2. 水平中心：兩眼中點的 x。
3. 垂直：一般尺寸讓頭頂距上緣 `topMm`；美簽讓眼睛距下緣 31.5 mm。
4. 裁切超出原圖時不移動臉，超出區域填白，並在 UI 標示「照片邊緣不夠，已補白」。

`renderCrop(source, crop, size, dpi)` 把裁切畫成指定 DPI 的 canvas（預設 300 DPI）。

## 5. 狀態（Redux）

三大原則：

- **單一資料來源**：一個 store，slice 為 `settings`、`photos`、`editor`。
- **State 唯讀、只能用 action 改**：所有變更經 reducer。
- **純函式 reducer**：副作用（解碼、偵測、輸出）放在 thunk；像素與 MediaPipe 實例放在 store 外的 `imageCache`（以 photo id 為 key）。

### settings（存 localStorage，URL 參數可覆寫）

```js
{ marginMm: 3, gapMm: 2, cutLines: true, dpi: 300 }
```

### photos（entity adapter）

```js
{
  id, name,
  status: "decoding" | "detecting" | "ready" | "error",
  error: null | string,
  features: null | { leftEye, rightEye, forehead, chin, headTop, angle },
  crops: { [sizeId]: { cx, cy, pxPerMm, angle } },
  manual: { [sizeId]: true },      // user-edited crops are not overwritten by re-detection
  counts: { [sizeId]: number },    // default { "2in": 4, "1in": 4 } fills exactly one sheet
  padded: { [sizeId]: true },      // crop extends past the photo
}
```

偵測不到臉：`features: null`，每個尺寸給置中的預設裁切，卡片顯示「沒找到臉，請手動裁切」。

### editor

```js
{ photoId, sizeId, crop, past: [], future: [] }   // HISTORY_LIMIT = 50
```

### 衍生資料

排版結果不存 state，由 selector `selectSheets` 從 `photos` 與 `settings` 計算（memoized）。

## 6. 排版（`src/lib/layout.js`）

- 相紙 4×6 吋 = 152.4 × 101.6 mm。
- 輸入：每張要印的照片 `{ photoId, sizeId, w, h }`，依 counts 展開。
- 演算法：依高度由大到小排序，shelf packing；同一批分別試橫式與直式相紙，取張數少者，張數相同取橫式。照片本身不旋轉。
- 可用範圍扣掉 `marginMm`，照片間距 `gapMm`。
- 單張照片放不下（不會發生在內建尺寸）時丟出錯誤。

預期容量（邊界 3 mm、間距 2 mm）：2 吋 8 張；1 吋 12 張（直式）；2 吋 ×4 + 1 吋 ×4 剛好一張。

## 7. 輸出（`src/lib/sheet.js`）

- 每張相紙輸出 JPG，300 DPI：橫式 1800×1200、直式 1200×1800 px，品質 0.95，白底。
- `cutLines` 開啟時在每張照片外框畫 0.1 mm 淺灰線。
- 檔名 `證件照-4x6-1.jpg`、`-2.jpg`…；多張時逐一下載。
- 介面提醒：沖印時選 4×6、不要裁切或「填滿」。

## 8. 介面

```
┌ 頁首：證件照排版｜免費、無廣告、照片不上傳 ┐
├ 左：設定（邊界、間距、裁切線） ──┬ 右：上傳區 ─────────────┤
│                                  │ 照片卡片 × N              │
│                                  │  縮圖、狀態、各尺寸張數    │
│                                  │  每個尺寸一個「調整」按鈕   │
│                                  ├ 4×6 預覽（每張相紙）      ┤
│                                  │ [全部下載]                 │
└ 靜態說明與 FAQ（給搜尋引擎） ─────────────────────────────┘
```

### 裁切編輯器（dialog）

- 畫面固定顯示所選尺寸的裁切框，使用者拖曳移動照片、滾輪或雙指縮放、滑桿旋轉（±15°）。
- 參考線：
  - 垂直中線。
  - 頭頂區帶：依 `topMm` 與 `headRange` 換算可接受的頭頂位置。
  - 下巴區帶：頭頂目標 + `headRange`。
  - 美簽另有眼睛區帶（距下緣 28–35 mm）。
- 按鈕：上一步、下一步（Ctrl+Z / Ctrl+Y）、重新自動裁切、套用、取消。

## 9. 錯誤處理

| 情況 | 行為 |
|---|---|
| 檔案無法解碼 | 卡片顯示錯誤，可移除 |
| MediaPipe 載入失敗（離線） | 所有照片給置中裁切，顯示「人臉偵測載入失敗，請手動裁切」 |
| 偵測不到臉 | 同上，僅該照片 |
| 裁切超出照片 | 補白並標示 |
| 張數全為 0 | 預覽區顯示「尚未選擇張數」，下載按鈕停用 |

## 10. 測試

單元（Vitest）：

- `sizes`：表格完整性。
- `crop`：autoCrop 讓頭高、頭頂位置、美簽眼睛位置符合規格；補白判斷。
- `headTop`：合成影像（素色背景＋橢圓頭）找到頭頂；雜背景時退回估計。
- `layout`：各尺寸容量、混合排版、換頁、所有照片在可用範圍內、不重疊。
- reducers：photos、editor（含歷史上限）、settings、persistence。
- thunks：mock 解碼與 `detectFace`。

E2E（Playwright）：

- 使用者自己的照片屬個資，不放進 repo。
- 樣本照片 `e2e/fixtures/sample-2in.jpg`（Git LFS）：身分證官方樣本照片（可公開放進 repo），467×600 px（35×45 mm，約 13.34 px/mm）。原圖有兩條標示頭頂與下巴的細線，已用 `scripts/clean_sample.py` 去除（白底處 inpaint、頭髮處逐欄上下內插）。標準答案寫在 `e2e/fixtures/sample-2in.json`：頭頂 y = 30.5、下巴 y = 510.5（頭高 36 mm）。
- `face.spec.js`：用真實 MediaPipe 偵測樣本照片，頭頂與下巴誤差需在 1 mm（約 13 px）內；並把樣本放大、加白邊、旋轉 5° 後再測一次，確認自動裁切的 2 吋輸出頭高落在 32–36 mm。
- `sheet.spec.js`：透過 DEV 專用的 `window.__faceStub` 注入固定特徵點（不依賴網路模型），測試上傳 → 張數 → 預覽 → 下載的 JPG 尺寸與照片擺放位置。
- 選用：設定 `E2E_PHOTOS_DIR` 指向本機照片資料夾時，也用真實 MediaPipe 檢查頭高落在規格範圍內。

## 11. 專案與部署

- 路徑 `D:\Projects\tw-id-photo`，GitHub repo `kako0507/tw-id-photo`。
- git user：Tim Kuo <kako0507@gmail.com>；專案專用 SSH key `~/.ssh/tw-id-photo_ed25519`，host alias `github-tw-id-photo`。
- commit 訊息結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- README：上半部給一般使用者（功能、用法、FAQ、沖印注意），接著提示「以下是技術說明」，再寫技術內容。
- SEO：title／description／keywords 強調「證件照 4×6 排版、免費、無廣告、照片不上傳」，canonical、OG、Twitter、JSON-LD（WebApplication、FAQPage）、靜態教學與 FAQ、robots.txt、sitemap.xml。
