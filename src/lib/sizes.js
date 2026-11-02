// The single table of supported photo sizes. All dimensions are in mm.
// headMm: target chin-to-crown distance; headRange: allowed range (guide lines).
// Head position is either topMm (crown to top edge) or eyeFromBottomMm (eyes to bottom edge).
// The 1in and 2in-half ranges are estimates; this table is the only place to change them.
export const SIZES = [
  { id: "2in", name: "2 吋大頭照", use: "身分證、護照、健保卡、台胞證", w: 35, h: 45, headMm: 34, headRange: [32, 36], topMm: 4 },
  { id: "1in", name: "1 吋", use: "駕照、體健表、身心障礙證明", w: 28, h: 35, headMm: 24, headRange: [22, 26], topMm: 4 },
  { id: "2in-half", name: "2 吋半身照", use: "學生證、履歷、證書執照", w: 42, h: 47, headMm: 24, headRange: [20, 28], topMm: 5 },
  { id: "us-visa", name: "美國簽證", use: "美國簽證", w: 50, h: 50, headMm: 30, headRange: [25, 35], eyeFromBottomMm: 31.5, eyeRange: [28, 35] },
];

export const SIZE_BY_ID = Object.fromEntries(SIZES.map((s) => [s.id, s]));

// Photo counts used when a new photo is added
export const DEFAULT_COUNTS = { "2in": 4, "1in": 4 };

// 4x6 inch sheet, landscape [width, height] in mm
export const SHEET_MM = [152.4, 101.6];
