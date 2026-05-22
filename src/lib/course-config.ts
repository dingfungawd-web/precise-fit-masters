export type CourseField = {
  key: string;
  label: string;
  long?: boolean;
  videoKey?: string;
};

export const COURSE_CONFIG: Record<
  string,
  {
    description: string;
    groupBy: string;
    titleField: string;
    fields: CourseField[];
  }
> = {
  "1": {
    description: "認識基本門窗類型，按門窗分類 → 款式 → 細分結構及度尺要點。",
    groupBy: "門窗分類",
    titleField: "款式名稱",
    fields: [
      { key: "常用樓宇", label: "常用樓宇" },
      { key: "細分", label: "細分" },
      { key: "結構", label: "結構", long: true },
      { key: "基本度尺", label: "基本度尺", long: true },
      { key: "常見伏位", label: "常見伏位", long: true },
    ],
  },
  "2": {
    description: "鋁通料目錄，按通料名稱分類，每個細分有用途及組合說明。",
    groupBy: "通料名稱",
    titleField: "細心",
    fields: [
      { key: "用途", label: "用途", long: true },
      { key: "組合", label: "組合", long: true },
    ],
  },
  "3": {
    description: "產品款式及測量方法。涵蓋規格、極限尺寸、做法、度尺方法及錯誤案例。",
    groupBy: "門窗分類",
    titleField: "款式名稱",
    fields: [
      { key: "供應商", label: "供應商" },
      { key: "安裝場景", label: "安裝場景" },
      { key: "功能", label: "功能" },
      { key: "框色選擇", label: "框色選擇", long: true },
      { key: "網材選擇", label: "網材選擇", long: true },
      { key: "產品規格", label: "產品規格", long: true },
      { key: "極限尺寸", label: "極限尺寸", long: true },
      { key: "款式常見做法", label: "款式常見做法", long: true },
      { key: "款式特別做法", label: "款式特別做法", long: true },
      { key: "款式度尺口訣", label: "款式度尺口訣", long: true },
      { key: "基本度尺方法", label: "基本度尺方法", long: true },
      { key: "進階度尺方法", label: "進階度尺方法", long: true },
      { key: "錯誤案例庫", label: "錯誤案例庫", long: true, videoKey: "錯誤案例庫_影片" },
      { key: "產品影片庫", label: "產品影片庫", long: true, videoKey: "產品影片庫_影片" },
    ],
  },
};
