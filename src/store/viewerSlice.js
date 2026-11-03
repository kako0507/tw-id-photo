import { createSlice } from "@reduxjs/toolkit";

// Sheet viewer (enlarged 4x6 with rulers). sheetIndex === null means closed
const viewerSlice = createSlice({
  name: "viewer",
  initialState: { sheetIndex: null },
  reducers: {
    viewerOpened: (_, { payload: sheetIndex }) => ({ sheetIndex }),
    viewerClosed: () => ({ sheetIndex: null }),
  },
});

export const { viewerOpened, viewerClosed } = viewerSlice.actions;
export default viewerSlice.reducer;
