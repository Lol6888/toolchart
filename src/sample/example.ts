import type { ChartDocument } from "../types/chart";

// Sample xấp xỉ ảnh input (2 panel + inset + error bars + reference lines + legend).
// Dùng để demo pipeline render/edit/export khi chưa gọi Gemini. Số liệu là ước lượng.

const G = "#5AA02C"; // xanh lá (S-PA)
const O = "#E8A33D"; // cam/vàng (3M-Gu) panel trái
const OR = "#E8542A"; // cam-đỏ (đường nối panel phải)

export const SAMPLE_DOC: ChartDocument = {
  width: 2000,
  height: 980,
  background: "#FFFFFF",
  defaultFontFamily: "Arial",
  panels: [
    // ---------------- PANEL TRÁI: CCS ----------------
    {
      id: "left",
      title: {
        id: "t-left",
        content: "CCS",
        x: 525,
        y: 40,
        fontSize: 18,
        fontFamily: "Arial",
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#000",
        anchor: "middle",
        rotation: 0,
      },
      plotArea: { x: 150, y: 70, width: 750, height: 820 },
      xAxis: { label: "% of Target mAb Load", min: 0, max: 70, ticks: [0, 10, 20, 30, 40, 50, 60, 70], tickFormat: "percent" },
      yAxis: { label: "HCP (ppm)", min: 0, max: 260, ticks: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260], tickFormat: "number" },
      referenceLines: [
        { id: "ref-15", orientation: "horizontal", value: 260, color: "#000", lineStyle: "solid", lineWidth: 1.5, label: "Feed (CCS; 15 mS/cm)", showInLegend: true },
        { id: "ref-5", orientation: "horizontal", value: 215, color: "#000", lineStyle: "dashed", lineWidth: 1.5, label: "Feed (CCS; 5 mS/cm)", showInLegend: true },
      ],
      series: [
        {
          id: "spa5", name: "S-PA, 5 mS/cm", color: G, marker: "circle", markerFilled: true, markerSize: 12, lineStyle: "dashed", lineWidth: 2, showInLegend: true,
          points: [
            { x: 6, y: 31, errorPlus: 3, errorMinus: 3 }, { x: 13, y: 78, errorPlus: 5, errorMinus: 5 },
            { x: 20, y: 71, errorPlus: 6, errorMinus: 6 }, { x: 27, y: 70, errorPlus: 6, errorMinus: 6 },
            { x: 33, y: 73, errorPlus: 8, errorMinus: 8 }, { x: 41, y: 76, errorPlus: 8, errorMinus: 8 },
            { x: 47, y: 93, errorPlus: 6, errorMinus: 6 }, { x: 53, y: 113, errorPlus: 4, errorMinus: 4 },
            { x: 60, y: 118, errorPlus: 19, errorMinus: 19 }, { x: 66, y: 132, errorPlus: 22, errorMinus: 22 },
          ],
        },
        {
          id: "spa15", name: "S-PA, 15 mS/cm", color: G, marker: "triangle", markerFilled: true, markerSize: 13, lineStyle: "solid", lineWidth: 2, showInLegend: true,
          points: [
            { x: 6, y: 60, errorPlus: 6, errorMinus: 6 }, { x: 13, y: 77, errorPlus: 6, errorMinus: 6 },
            { x: 20, y: 69, errorPlus: 6, errorMinus: 6 }, { x: 27, y: 68, errorPlus: 6, errorMinus: 6 },
            { x: 33, y: 62, errorPlus: 6, errorMinus: 6, filled: false }, { x: 36, y: 68, errorPlus: 6, errorMinus: 6 },
            { x: 43, y: 78, errorPlus: 6, errorMinus: 6 }, { x: 49, y: 75, errorPlus: 6, errorMinus: 6 },
            { x: 57, y: 79, errorPlus: 6, errorMinus: 6 }, { x: 64, y: 89, errorPlus: 5, errorMinus: 5 },
            { x: 69, y: 100, errorPlus: 8, errorMinus: 8 },
          ],
        },
        {
          id: "gu5", name: "3M-Gu, 5 mS/cm", color: O, marker: "square", markerFilled: true, markerSize: 12, lineStyle: "dashed", lineWidth: 2, showInLegend: true,
          points: [
            { x: 6, y: 2 }, { x: 13, y: 2 }, { x: 20, y: 4 }, { x: 27, y: 4 }, { x: 33, y: 5 },
            { x: 41, y: 5 }, { x: 47, y: 6 }, { x: 53, y: 6 }, { x: 59, y: 8, filled: false }, { x: 65, y: 8, filled: false },
          ],
        },
        {
          id: "gu15", name: "3M-Gu, 15 mS/cm", color: O, marker: "diamond", markerFilled: true, markerSize: 13, lineStyle: "solid", lineWidth: 2, showInLegend: true,
          points: [
            { x: 6, y: 16 }, { x: 13, y: 22 }, { x: 20, y: 24 }, { x: 27, y: 25 }, { x: 33, y: 29, errorPlus: 2, errorMinus: 2 },
            { x: 41, y: 28 }, { x: 47, y: 28 }, { x: 53, y: 28 }, { x: 59, y: 30, filled: false }, { x: 65, y: 29 },
          ],
        },
      ],
      legends: [
        {
          id: "lg-left", bounds: { x: 200, y: 130, width: 320, height: 270 }, fontSize: 15, fontFamily: "Arial", showBorder: true, background: "#FFFFFF",
          entries: [
            { refId: "ref-5", label: "Feed (CCS; 5 mS/cm)" },
            { refId: "ref-15", label: "Feed (CCS; 15 mS/cm)" },
            { refId: "spa5", label: "S-PA, 5 mS/cm" },
            { refId: "spa15", label: "S-PA, 15 mS/cm" },
            { refId: "gu5", label: "3M-Gu, 5 mS/cm" },
            { refId: "gu15", label: "3M-Gu, 15 mS/cm" },
          ],
        },
      ],
      insets: [],
      showBorder: false,
    },
    // ---------------- PANEL PHẢI: CCS_thru_AEXHP ----------------
    {
      id: "right",
      title: {
        id: "t-right", content: "CCS_thru_AEXHP", x: 1575, y: 40, fontSize: 18, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal", color: "#000", anchor: "middle", rotation: 0,
      },
      plotArea: { x: 1200, y: 70, width: 750, height: 820 },
      xAxis: { label: "% of Target mAb Load", min: 0, max: 70, ticks: [0, 10, 20, 30, 40, 50, 60, 70], tickFormat: "percent" },
      yAxis: { label: "HCP (ppm)", min: 0, max: 260, ticks: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260], tickFormat: "number" },
      referenceLines: [
        { id: "r-15", orientation: "horizontal", value: 31, color: "#000", lineStyle: "solid", lineWidth: 1.5, label: "Feed (CCS_thru_AEXHP; 15 mS/cm)", showInLegend: true },
        { id: "r-5", orientation: "horizontal", value: 27, color: "#000", lineStyle: "dashed", lineWidth: 1.5, label: "Feed (CCS_thru_AEXHP; 5 mS/cm)", showInLegend: true },
      ],
      series: [
        {
          id: "r-spa5", name: "S-PA, 5 mS/cm", color: G, marker: "circle", markerFilled: true, markerSize: 11, lineStyle: "solid", lineWidth: 2, showInLegend: true,
          points: [{ x: 6, y: 4 }, { x: 12, y: 10 }, { x: 17, y: 17 }, { x: 24, y: 18 }, { x: 30, y: 18 }, { x: 36, y: 18 }, { x: 43, y: 17 }, { x: 50, y: 17 }, { x: 60, y: 18 }],
        },
        {
          id: "r-spa15", name: "S-PA, 15 mS/cm", color: G, marker: "triangle", markerFilled: true, markerSize: 12, lineStyle: "dashed", lineWidth: 2, showInLegend: true,
          points: [{ x: 6, y: 7 }, { x: 12, y: 16 }, { x: 17, y: 16 }, { x: 24, y: 16 }, { x: 30, y: 16 }, { x: 36, y: 16 }, { x: 45, y: 16 }, { x: 52, y: 16 }, { x: 57, y: 16, filled: false }],
        },
        {
          id: "r-gu5", name: "3M-Gu, 5 mS/cm", color: OR, marker: "square", markerFilled: true, markerSize: 11, lineStyle: "dashed", lineWidth: 2, showInLegend: true,
          points: [{ x: 6, y: 1 }, { x: 12, y: 2 }, { x: 17, y: 2 }, { x: 24, y: 3 }, { x: 30, y: 3 }, { x: 36, y: 3 }, { x: 45, y: 4 }, { x: 52, y: 4 }, { x: 57, y: 4, filled: false }],
        },
        {
          id: "r-gu15", name: "3M-Gu, 15 mS/cm", color: OR, marker: "diamond", markerFilled: true, markerSize: 12, lineStyle: "solid", lineWidth: 2, showInLegend: true,
          points: [{ x: 6, y: 3 }, { x: 12, y: 5 }, { x: 17, y: 6 }, { x: 24, y: 7 }, { x: 30, y: 7 }, { x: 36, y: 7 }, { x: 45, y: 7 }, { x: 52, y: 8 }, { x: 57, y: 8 }],
        },
      ],
      legends: [
        {
          id: "lg-right", bounds: { x: 1250, y: 90, width: 360, height: 300 }, fontSize: 15, fontFamily: "Arial", showBorder: false, background: "transparent",
          entries: [
            { refId: "r-5", label: "Feed (CCS_thru_AEXHP; 5 mS/cm)" },
            { refId: "r-15", label: "Feed (CCS_thru_AEXHP; 15 mS/cm)" },
            { refId: "r-spa5", label: "S-PA, 5 mS/cm" },
            { refId: "r-spa15", label: "S-PA, 15 mS/cm" },
            { refId: "r-gu5", label: "3M-Gu, 5 mS/cm" },
            { refId: "r-gu15", label: "3M-Gu, 15 mS/cm" },
          ],
        },
      ],
      // ---- INSET trong panel phải ----
      insets: [
        {
          id: "inset",
          plotArea: { x: 1480, y: 210, width: 420, height: 300 },
          xAxis: { label: "% of Target mAb Load", min: 0, max: 60, ticks: [0, 20, 40, 60], tickFormat: "percent" },
          yAxis: { label: "HCP (ppm)", min: 0, max: 35, ticks: [0, 5, 10, 15, 20, 25, 30, 35], tickFormat: "number" },
          referenceLines: [
            { id: "i-15", orientation: "horizontal", value: 31, color: "#000", lineStyle: "solid", lineWidth: 1.5, showInLegend: false },
            { id: "i-5", orientation: "horizontal", value: 27, color: "#000", lineStyle: "dashed", lineWidth: 1.5, showInLegend: false },
          ],
          series: [
            { id: "i-spa5", name: "S-PA, 5 mS/cm", color: G, marker: "circle", markerFilled: true, markerSize: 10, lineStyle: "dashed", lineWidth: 2, showInLegend: false,
              points: [{ x: 5, y: 3 }, { x: 11, y: 9.5, errorPlus: 1, errorMinus: 1 }, { x: 17, y: 16.5 }, { x: 24, y: 17 }, { x: 30, y: 17 }, { x: 36, y: 17.5 }, { x: 45, y: 17 }, { x: 52, y: 17.5 }, { x: 60, y: 17.5 }] },
            { id: "i-spa15", name: "S-PA, 15 mS/cm", color: G, marker: "triangle", markerFilled: true, markerSize: 11, lineStyle: "solid", lineWidth: 2, showInLegend: false,
              points: [{ x: 5, y: 7 }, { x: 11, y: 15.5 }, { x: 17, y: 16 }, { x: 24, y: 15.5 }, { x: 30, y: 16 }, { x: 36, y: 16 }, { x: 45, y: 16 }, { x: 52, y: 16 }, { x: 57, y: 15.5, filled: false }] },
            { id: "i-gu5", name: "3M-Gu, 5 mS/cm", color: OR, marker: "square", markerFilled: true, markerSize: 10, lineStyle: "dashed", lineWidth: 2, showInLegend: false,
              points: [{ x: 5, y: 0.8 }, { x: 11, y: 1 }, { x: 17, y: 2 }, { x: 24, y: 2.5 }, { x: 30, y: 3 }, { x: 36, y: 3 }, { x: 45, y: 4 }, { x: 52, y: 3.5 }, { x: 57, y: 3.5 }] },
            { id: "i-gu15", name: "3M-Gu, 15 mS/cm", color: OR, marker: "diamond", markerFilled: true, markerSize: 11, lineStyle: "solid", lineWidth: 2, showInLegend: false,
              points: [{ x: 5, y: 3 }, { x: 11, y: 5.5 }, { x: 17, y: 6.5 }, { x: 24, y: 7 }, { x: 30, y: 7 }, { x: 36, y: 7.5 }, { x: 45, y: 7.5 }, { x: 52, y: 8 }, { x: 57, y: 8 }] },
          ],
          legends: [],
          insets: [],
          showBorder: true,
        },
      ],
      showBorder: false,
    },
  ],
  freeTexts: [],
};

// Sample bar chart ngang (grouped horizontal bars) — xấp xỉ ảnh input "Recovery vs pI".
// Trục Y là category (pI: 4.5/7.0/8.5/10.5), trục X là Recovery %.
const BLUE = "#4472C4";
const ORANGE = "#ED7D31";
const GREEN = "#70AD47";
const GOLD = "#FFC000";

export const SAMPLE_BAR_DOC: ChartDocument = {
  width: 520,
  height: 520,
  background: "#FFFFFF",
  defaultFontFamily: "Arial",
  panels: [
    {
      id: "bar",
      plotArea: { x: 95, y: 40, width: 380, height: 380 },
      xAxis: { label: "Recovery (%)", min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], tickFormat: "number", type: "linear" },
      yAxis: { label: "Isoelectric Point (pI)", min: 0, max: 1, ticks: [4.5, 7.0, 8.5, 10.5], tickFormat: "number", type: "category" },
      referenceLines: [],
      series: [
        { id: "b-gold", name: "Nhóm 1", color: GOLD, marker: "none", markerFilled: true, markerSize: 0, lineStyle: "none", lineWidth: 0, showInLegend: false, kind: "bar", barOrientation: "horizontal",
          points: [{ x: 85, y: 10.5, errorPlus: 6, errorMinus: 6, filled: false }] },
        { id: "b-green", name: "Nhóm 2", color: GREEN, marker: "none", markerFilled: true, markerSize: 0, lineStyle: "none", lineWidth: 0, showInLegend: false, kind: "bar", barOrientation: "horizontal",
          points: [{ x: 85, y: 10.5 }, { x: 30, y: 8.5 }] },
        { id: "b-orange", name: "Nhóm 3", color: ORANGE, marker: "none", markerFilled: true, markerSize: 0, lineStyle: "none", lineWidth: 0, showInLegend: false, kind: "bar", barOrientation: "horizontal",
          points: [{ x: 90, y: 10.5, errorPlus: 7, errorMinus: 7 }, { x: 80, y: 8.5, errorPlus: 6, errorMinus: 6 }] },
        { id: "b-blue", name: "Nhóm 4", color: BLUE, marker: "none", markerFilled: true, markerSize: 0, lineStyle: "none", lineWidth: 0, showInLegend: false, kind: "bar", barOrientation: "horizontal",
          points: [{ x: 78, y: 10.5 }, { x: 72, y: 8.5 }] },
      ],
      legends: [],
      insets: [],
      showBorder: true,
    },
  ],
  freeTexts: [],
};
