// Schema JSON mô tả toàn bộ biểu đồ. AI xuất ra cấu trúc này, renderer đọc và vẽ SVG.
// Tọa độ bounds/plotArea tính theo pixel trong hệ toạ độ của cả document (gốc trên-trái).

export type MarkerShape = "circle" | "square" | "triangle" | "diamond" | "none";
export type LineStyle = "solid" | "dashed" | "dotted" | "none";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Axis {
  label: string;
  min: number;
  max: number;
  ticks: number[];
  // 'percent' -> hiển thị "10%", 'number' -> "10"
  tickFormat: "percent" | "number";
  // 'linear' (mặc định): scale theo min/max. 'category': mỗi tick là 1 nhóm đều nhau,
  // dùng cho bar chart phân loại (vd trục pI: 4.5, 7.0, 8.5, 10.5). Bỏ trống = linear.
  type?: "linear" | "category";
}

export interface DataPoint {
  x: number;
  y: number;
  // Sai số theo trục Y (dương/âm). Bỏ trống nếu không có.
  errorPlus?: number;
  errorMinus?: number;
  // Sai số theo trục X.
  xErrorPlus?: number;
  xErrorMinus?: number;
  // Override riêng cho 1 điểm: marker rỗng (viền, không tô) — ví dụ điểm rỗng cuối các đường.
  filled?: boolean;
}

export interface Series {
  id: string;
  name: string;
  color: string; // mã hex, vd "#5AA02C"
  marker: MarkerShape;
  markerFilled: boolean; // true = tô đặc, false = chỉ viền
  markerSize: number; // đường kính px
  lineStyle: LineStyle;
  lineWidth: number;
  points: DataPoint[];
  showInLegend: boolean;

  // --- Bar chart ---
  // 'line' (mặc định): vẽ đường + marker. 'bar': vẽ thanh. Bỏ trống = line.
  kind?: "line" | "bar";
  // Chỉ dùng khi kind='bar'. 'horizontal': thanh chạy dọc trục X, nhóm theo category trên trục Y.
  // 'vertical': thanh chạy dọc trục Y, nhóm theo category trên trục X. Bỏ trống = vertical.
  barOrientation?: "horizontal" | "vertical";
  // Với bar: mỗi DataPoint có toạ độ trên trục category = giá trị category (vd y=8.5),
  // toạ độ trên trục giá trị = độ dài thanh tính từ 0 (vd x=80). Error bar áp lên trục giá trị.
  // point.filled=false => thanh chỉ có viền, không tô (thanh trắng).
}

export interface ReferenceLine {
  id: string;
  orientation: "horizontal" | "vertical";
  value: number; // giá trị theo trục tương ứng
  color: string;
  lineStyle: LineStyle;
  lineWidth: number;
  label?: string; // nhãn hiển thị trong legend
  showInLegend: boolean;
}

export interface TextSpec {
  id: string;
  content: string;
  // Vị trí tính theo pixel document.
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  anchor: "start" | "middle" | "end";
  rotation: number; // độ, âm = ngược chiều kim đồng hồ (dùng cho nhãn trục Y dọc)
}

export interface LegendEntry {
  // Tham chiếu tới series hoặc reference line qua id; renderer lấy style từ đó.
  refId: string;
  label: string;
}

export interface Legend {
  id: string;
  bounds: Rect;
  entries: LegendEntry[];
  fontSize: number;
  fontFamily: string;
  showBorder: boolean;
  background: string; // "transparent" hoặc hex
}

export interface Panel {
  id: string;
  title?: TextSpec;
  // Vùng vẽ dữ liệu (bên trong trục), pixel document.
  plotArea: Rect;
  xAxis: Axis;
  yAxis: Axis;
  series: Series[];
  referenceLines: ReferenceLine[];
  legends: Legend[];
  // Biểu đồ lồng bên trong (đệ quy). Rỗng nếu không có.
  insets: Panel[];
  showBorder: boolean;
}

export interface ChartDocument {
  width: number;
  height: number;
  background: string;
  // Font mặc định toàn document; từng text có thể override.
  defaultFontFamily: string;
  panels: Panel[];
  // Text tự do không thuộc panel nào (hiếm dùng).
  freeTexts: TextSpec[];
}
