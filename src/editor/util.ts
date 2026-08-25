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

// Đánh giá điểm trên đường cong Catmull-Rom giữa p1..p2 (neighbor p0,p3), t trong [0,1].
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

// Chèn thêm `insertPerSegment` chấm giữa mỗi cặp điểm liên tiếp, đặt đúng trên đường cong.
// Giữ nguyên các điểm gốc; chấm mới chỉ có x,y (không error bar).
export function densifyPoints(
  points: { x: number; y: number }[],
  insertPerSegment = 1
): { x: number; y: number }[] {
  if (points.length < 2 || insertPerSegment < 1) return points;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    out.push({ ...p1 });
    for (let j = 1; j <= insertPerSegment; j++) {
      const t = j / (insertPerSegment + 1);
      out.push({
        x: round2(catmullRom(p0.x, p1.x, p2.x, p3.x, t)),
        y: round2(catmullRom(p0.y, p1.y, p2.y, p3.y, t)),
      });
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}
