import type { ChartDocument, Panel, Axis } from "../types/chart";

// Phần tử đang được chọn trên canvas.
export type Selection =
  | { kind: "point"; panelId: string; seriesId: string; index: number }
  | { kind: "text"; id: string };

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Duyệt tất cả panel (kể cả inset lồng nhau).
export function walkPanels(doc: ChartDocument): Panel[] {
  const out: Panel[] = [];
  const rec = (p: Panel) => {
    out.push(p);
    p.insets.forEach(rec);
  };
  doc.panels.forEach(rec);
  return out;
}

export function findPanel(doc: ChartDocument, id: string): Panel | undefined {
  return walkPanels(doc).find((p) => p.id === id);
}

// Pixel -> giá trị dữ liệu trên trục tuyến tính (nghịch của scaleX/scaleY).
export function invLinear(
  axis: Axis,
  start: number,
  len: number,
  px: number,
  invert: boolean
): number {
  const frac = invert ? (start + len - px) / len : (px - start) / len;
  return round2(axis.min + frac * (axis.max - axis.min));
}

export function clampAxis(axis: Axis, v: number): number {
  return Math.min(axis.max, Math.max(axis.min, v));
}

export function isPointSelected(
  sel: Selection | null,
  panelId: string,
  seriesId: string,
  index: number
): boolean {
  return (
    !!sel &&
    sel.kind === "point" &&
    sel.panelId === panelId &&
    sel.seriesId === seriesId &&
    sel.index === index
  );
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
