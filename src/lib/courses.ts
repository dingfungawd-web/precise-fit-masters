export interface CourseMeta {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  status: "ready" | "placeholder" | "manual";
  source: string;
}

export const COURSES: CourseMeta[] = [
  {
    id: "1",
    number: "課程一",
    title: "門窗類型",
    subtitle: "5 種門款 + 4 種窗款，認識基礎門窗結構",
    status: "ready",
    source: "Google Sheets",
  },
  {
    id: "2",
    number: "課程二",
    title: "鋁通料",
    subtitle: "鋁扁、鋁角、鋁通、冚槽條、匠格底框、漢紗副框",
    status: "ready",
    source: "Google Sheets",
  },
  {
    id: "3",
    number: "課程三",
    title: "產品款式及測量方法",
    subtitle: "3 種門款 + 6 種窗款，詳細度尺流程",
    status: "ready",
    source: "Google Sheets",
  },
  {
    id: "4",
    number: "課程四",
    title: "款式決策助手",
    subtitle: "流程決策樹形圖：根據場景快速建議款式及做法",
    status: "ready",
    source: "Google Sheets",
  },
  {
    id: "5",
    number: "課程五",
    title: "（待定）",
    subtitle: "內容稍後提供",
    status: "placeholder",
    source: "Google Sheets",
  },
  {
    id: "6",
    number: "課程六",
    title: "（待定）",
    subtitle: "內容由系統內建（不經 Google Sheets）",
    status: "manual",
    source: "系統內建",
  },
];
