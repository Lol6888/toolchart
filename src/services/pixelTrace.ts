// Quét lại các series 'stem' (histogram dày) trực tiếp từ pixel ảnh gốc.
// Gemini cho khung plot, trục, màu; ở đây đọc chiều cao từng cột pixel nên khớp ảnh tới mức pixel
// — điều vision model không làm được với hàng trăm thanh.
import type { ChartDocument, Panel, Series } from "../types/chart";
import { loadImage } from "./gemini";
import { walkPanels } from "../editor/util";

interface Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

// Một đường kẻ dò được: tâm (toạ độ pixel liên tục) + dải pixel nó chiếm.
interface Line {
  center: number;
  lo: number;
  hi: number;
}

function rgbAt(img: Img, x: number, y: number): [number, number, number] {
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

function hsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Pixel đen/xám đậm (đường trục, khung) — không tính màu bão hoà như thanh xanh đậm.
function isDark(img: Img, x: number, y: number): boolean {
  const [r, g, b] = rgbAt(img, x, y);
  return Math.max(r, g, b) < 130 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
}

// Tìm đường kẻ đậm mạnh nhất trong [from, to]; count(i) = số pixel đậm trên hàng/cột i.
// Đường dày 2-3px thì gộp các hàng/cột liền kề đủ mạnh. Không đủ dài => null.
function findLine(count: (i: number) => number, from: number, to: number, minCount: number): Line | null {
  let best = -1;
  let bestN = 0;
  for (let i = from; i <= to; i++) {
    const n = count(i);
    if (n > bestN) {
      bestN = n;
      best = i;
    }
  }
  if (best < 0 || bestN < minCount) return null;
  let lo = best;
  let hi = best;
  while (lo - 1 >= from && count(lo - 1) >= bestN * 0.6) lo--;
  while (hi + 1 <= to && count(hi + 1) >= bestN * 0.6) hi++;
  return { center: (lo + hi + 1) / 2, lo, hi };
}

// Dò 4 cạnh khung plot quanh vị trí Gemini dự đoán (đã đổi sang pixel ảnh).
// Cạnh nào không thấy đường kẻ (biểu đồ không có khung) thì giữ dự đoán.
function detectFrame(img: Img, pred: { l: number; r: number; t: number; b: number }) {
  const clampX = (v: number) => Math.max(0, Math.min(img.w - 1, Math.round(v)));
  const clampY = (v: number) => Math.max(0, Math.min(img.h - 1, Math.round(v)));
  const tolX = Math.max(8, Math.round(img.w * 0.04));
  const tolY = Math.max(8, Math.round(img.h * 0.04));
  const y0 = clampY(pred.t), y1 = clampY(pred.b);
  const x0 = clampX(pred.l), x1 = clampX(pred.r);

  const colCount = (x: number) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (isDark(img, x, y)) n++;
    return n;
  };
  const rowCount = (y: number) => {
    let n = 0;
    for (let x = x0; x <= x1; x++) if (isDark(img, x, y)) n++;
    return n;
  };
  const minV = (y1 - y0) * 0.6;
  const minH = (x1 - x0) * 0.6;
  const fallback = (v: number): Line => ({ center: v, lo: Math.floor(v), hi: Math.floor(v) });

  return {
    left: findLine(colCount, clampX(pred.l - tolX), clampX(pred.l + tolX), minV) ?? fallback(pred.l),
    right: findLine(colCount, clampX(pred.r - tolX), clampX(pred.r + tolX), minV) ?? fallback(pred.r),
    top: findLine(rowCount, clampY(pred.t - tolY), clampY(pred.t + tolY), minH) ?? fallback(pred.t),
    bottom: findLine(rowCount, clampY(pred.b - tolY), clampY(pred.b + tolY), minH) ?? fallback(pred.b),
  };
}

// Pixel có thuộc màu series không. Màu bão hoà: so theo hue (chịu được JPEG, khử răng cưa,
// và loại lưới nhạt cùng tông nhưng nhạt màu). Màu xám/đen: so khoảng cách RGB.
function colorMatcher(hex: string): (r: number, g: number, b: number) => boolean {
  const [tr, tg, tb] = hexToRgb(hex);
  const t = hsv(tr, tg, tb);
  if (t.s >= 0.2) {
    return (r, g, b) => {
      const c = hsv(r, g, b);
      const dh = Math.min(Math.abs(c.h - t.h), 360 - Math.abs(c.h - t.h));
      return c.s > 0.2 && c.v > 0.15 && dh < 35;
    };
  }
  return (r, g, b) => Math.hypot(r - tr, g - tg, b - tb) < 60;
}

function traceSeries(img: Img, p: Panel, s: Series, f: ReturnType<typeof detectFrame>, docPerPxX: number): Series {
  const { xAxis: ax, yAxis: ay } = p;
  const match = colorMatcher(s.color);
  const points: Series["points"] = [];
  const spanX = f.right.center - f.left.center;
  const spanY = f.bottom.center - f.top.center;
  // Chỉ quét phần bên trong khung, bỏ chính các pixel đường kẻ.
  for (let x = f.left.hi + 1; x < f.right.lo; x++) {
    for (let y = f.top.hi + 1; y < f.bottom.lo; y++) {
      const [r, g, b] = rgbAt(img, x, y);
      if (!match(r, g, b)) continue;
      // pixel đầu tiên (từ trên xuống) đúng màu = đỉnh thanh. Cột không có => không có thanh
      // (hoặc bị vùng tô khác che hoàn toàn — ảnh gốc cũng không thấy).
      const xv = ax.min + ((x + 0.5 - f.left.center) / spanX) * (ax.max - ax.min);
      const yv = ay.min + ((f.bottom.center - y) / spanY) * (ay.max - ay.min);
      points.push({
        x: Math.round(xv * 10000) / 10000,
        y: Math.round(Math.min(ay.max, Math.max(ay.min, yv)) * 100) / 100,
      });
      break;
    }
  }
  if (points.length === 0) return s; // không thấy pixel nào đúng màu => giữ bản xấp xỉ của Gemini
  // mỗi cột pixel ảnh = 1 vạch, rộng đúng 1 cột trong hệ toạ độ document
  return { ...s, points, lineWidth: docPerPxX, marker: "none" };
}

export async function traceStemsFromImage(doc: ChartDocument, file: File): Promise<ChartDocument> {
  const isTraceable = (p: Panel) =>
    p.xAxis.type !== "category" && p.yAxis.type !== "category" && p.series.some((s) => s.kind === "stem");
  if (!walkPanels(doc).some(isTraceable)) return doc;

  const el = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = el.naturalWidth;
  canvas.height = el.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(el, 0, 0);
  const img: Img = { w: canvas.width, h: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };

  // Gemini trả toạ độ theo hệ document của nó; quy đổi sang pixel ảnh gốc theo tỉ lệ.
  const kx = img.w / doc.width;
  const ky = img.h / doc.height;

  const out = structuredClone(doc);
  for (const p of walkPanels(out)) {
    if (!isTraceable(p)) continue;
    const a = p.plotArea;
    const f = detectFrame(img, { l: a.x * kx, r: (a.x + a.width) * kx, t: a.y * ky, b: (a.y + a.height) * ky });
    // Căn lại plotArea theo khung thật để thang giá trị của MỌI series khớp ảnh.
    p.plotArea = {
      x: f.left.center / kx,
      y: f.top.center / ky,
      width: (f.right.center - f.left.center) / kx,
      height: (f.bottom.center - f.top.center) / ky,
    };
    p.series = p.series.map((s) => (s.kind === "stem" ? traceSeries(img, p, s, f, 1 / kx) : s));
  }
  return out;
}
