import { createContext, useContext, useRef } from "react";
import type {
  ChartDocument,
  Panel,
  Series,
  Axis,
  ReferenceLine,
  Legend,
  TextSpec,
  MarkerShape,
  LineStyle,
  DataPoint,
} from "../types/chart";
import {
  type Selection,
  findPanel,
  walkPanels,
  invLinear,
  clampAxis,
  round2,
  isPointSelected,
} from "../editor/util";

// ---- context tương tác (chọn/kéo). Renderer tĩnh nếu không cấp editable. ----

interface EditorCtx {
  editable: boolean;
  selected: Selection | null;
  select: (s: Selection | null) => void;
  beginDragPoint: (
    e: React.PointerEvent,
    panelId: string,
    seriesId: string,
    index: number
  ) => void;
  beginDragText: (e: React.PointerEvent, id: string) => void;
}

const noop = () => {};
const EditorContext = createContext<EditorCtx>({
  editable: false,
  selected: null,
  select: noop,
  beginDragPoint: noop,
  beginDragText: noop,
});

const SEL_COLOR = "#1d4ed8"; // màu highlight khi chọn

// ---- helpers ----

function dashArray(style: LineStyle, w: number): string | undefined {
  if (style === "dashed") return `${w * 4} ${w * 3}`;
  if (style === "dotted") return `${w} ${w * 2}`;
  return undefined; // solid
}

function fmtTick(v: number, fmt: Axis["tickFormat"]): string {
  const s = Number.isInteger(v) ? String(v) : String(v);
  return fmt === "percent" ? `${s}%` : s;
}

// Vị trí pixel cho 1 category trên trục phân loại (đều nhau theo index tick).
function categoryCenter(ax: Axis, start: number, len: number, v: number, invert: boolean): number {
  const n = ax.ticks.length || 1;
  let idx = ax.ticks.indexOf(v);
  if (idx === -1) idx = 0;
  const frac = (idx + 0.5) / n;
  return invert ? start + len - frac * len : start + frac * len;
}
// Bề rộng 1 "băng" category (khoảng dành cho 1 nhóm bar).
function bandSize(ax: Axis, len: number): number {
  return len / (ax.ticks.length || 1);
}

function scaleX(p: Panel, v: number): number {
  const { plotArea: a, xAxis: ax } = p;
  if (ax.type === "category") return categoryCenter(ax, a.x, a.width, v, false);
  return a.x + ((v - ax.min) / (ax.max - ax.min)) * a.width;
}
function scaleY(p: Panel, v: number): number {
  const { plotArea: a, yAxis: ay } = p;
  if (ay.type === "category") return categoryCenter(ay, a.y, a.height, v, true);
  return a.y + a.height - ((v - ay.min) / (ay.max - ay.min)) * a.height;
}

function markerPath(shape: MarkerShape, cx: number, cy: number, size: number) {
  const r = size / 2;
  switch (shape) {
    case "square":
      return <rect x={cx - r} y={cy - r} width={size} height={size} />;
    case "triangle":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
        />
      );
    case "diamond":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        />
      );
    case "circle":
      return <circle cx={cx} cy={cy} r={r} />;
    default:
      return null;
  }
}

function Marker({
  shape,
  cx,
  cy,
  size,
  color,
  filled,
}: {
  shape: MarkerShape;
  cx: number;
  cy: number;
  size: number;
  color: string;
  filled: boolean;
}) {
  if (shape === "none") return null;
  const node = markerPath(shape, cx, cy, size);
  if (!node) return null;
  const fill = filled ? color : "#FFFFFF";
  return (
    <g fill={fill} stroke={color} strokeWidth={1.2}>
      {node}
    </g>
  );
}

// ---- sub-renderers ----

function AxesAndGrid({ p }: { p: Panel }) {
  const { plotArea: a, xAxis: ax, yAxis: ay } = p;
  const left = a.x;
  const bottom = a.y + a.height;
  return (
    <g>
      {/* khung plot */}
      {p.showBorder && (
        <rect
          x={a.x}
          y={a.y}
          width={a.width}
          height={a.height}
          fill="none"
          stroke="#000"
          strokeWidth={1}
        />
      )}
      {/* trục X + Y */}
      <line x1={left} y1={bottom} x2={a.x + a.width} y2={bottom} stroke="#000" strokeWidth={1} />
      <line x1={left} y1={a.y} x2={left} y2={bottom} stroke="#000" strokeWidth={1} />
      {/* tick X */}
      {ax.ticks.map((t, i) => {
        const x = scaleX(p, t);
        return (
          <g key={`xt${i}`}>
            <line x1={x} y1={bottom} x2={x} y2={bottom + 5} stroke="#000" strokeWidth={1} />
            <text x={x} y={bottom + 18} textAnchor="middle" fontSize={12} fill="#000">
              {fmtTick(t, ax.tickFormat)}
            </text>
          </g>
        );
      })}
      {/* tick Y */}
      {ay.ticks.map((t, i) => {
        const y = scaleY(p, t);
        return (
          <g key={`yt${i}`}>
            <line x1={left - 5} y1={y} x2={left} y2={y} stroke="#000" strokeWidth={1} />
            <text x={left - 9} y={y + 4} textAnchor="end" fontSize={12} fill="#000">
              {fmtTick(t, ay.tickFormat)}
            </text>
          </g>
        );
      })}
      {/* nhãn trục X */}
      <text
        x={a.x + a.width / 2}
        y={bottom + 40}
        textAnchor="middle"
        fontSize={13}
        fontWeight="bold"
        fill="#000"
      >
        {ax.label}
      </text>
      {/* nhãn trục Y (xoay dọc) */}
      <text
        x={left - 44}
        y={a.y + a.height / 2}
        textAnchor="middle"
        fontSize={13}
        fontWeight="bold"
        fill="#000"
        transform={`rotate(-90 ${left - 44} ${a.y + a.height / 2})`}
      >
        {ay.label}
      </text>
    </g>
  );
}

function RefLine({ p, r }: { p: Panel; r: ReferenceLine }) {
  const { plotArea: a } = p;
  if (r.orientation === "horizontal") {
    const y = scaleY(p, r.value);
    return (
      <line
        x1={a.x}
        y1={y}
        x2={a.x + a.width}
        y2={y}
        stroke={r.color}
        strokeWidth={r.lineWidth}
        strokeDasharray={dashArray(r.lineStyle, r.lineWidth)}
      />
    );
  }
  const x = scaleX(p, r.value);
  return (
    <line
      x1={x}
      y1={a.y}
      x2={x}
      y2={a.y + a.height}
      stroke={r.color}
      strokeWidth={r.lineWidth}
      strokeDasharray={dashArray(r.lineStyle, r.lineWidth)}
    />
  );
}

function ErrorBars({ p, s, pt }: { p: Panel; s: Series; pt: DataPoint }) {
  const cx = scaleX(p, pt.x);
  const cy = scaleY(p, pt.y);
  const cap = 4;
  const elems: JSX.Element[] = [];
  if (pt.errorPlus || pt.errorMinus) {
    const yTop = scaleY(p, pt.y + (pt.errorPlus ?? 0));
    const yBot = scaleY(p, pt.y - (pt.errorMinus ?? 0));
    elems.push(<line key="ev" x1={cx} y1={yTop} x2={cx} y2={yBot} stroke={s.color} strokeWidth={1} />);
    elems.push(<line key="et" x1={cx - cap} y1={yTop} x2={cx + cap} y2={yTop} stroke={s.color} strokeWidth={1} />);
    elems.push(<line key="eb" x1={cx - cap} y1={yBot} x2={cx + cap} y2={yBot} stroke={s.color} strokeWidth={1} />);
  }
  if (pt.xErrorPlus || pt.xErrorMinus) {
    const xR = scaleX(p, pt.x + (pt.xErrorPlus ?? 0));
    const xL = scaleX(p, pt.x - (pt.xErrorMinus ?? 0));
    elems.push(<line key="eh" x1={xL} y1={cy} x2={xR} y2={cy} stroke={s.color} strokeWidth={1} />);
    elems.push(<line key="el" x1={xL} y1={cy - cap} x2={xL} y2={cy + cap} stroke={s.color} strokeWidth={1} />);
    elems.push(<line key="er" x1={xR} y1={cy - cap} x2={xR} y2={cy + cap} stroke={s.color} strokeWidth={1} />);
  }
  return <g>{elems}</g>;
}

function SeriesRenderer({ p, s }: { p: Panel; s: Series }) {
  const ed = useContext(EditorContext);
  const pathD = s.points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${scaleX(p, pt.x)} ${scaleY(p, pt.y)}`)
    .join(" ");
  return (
    <g>
      {/* error bars vẽ trước để marker đè lên */}
      {s.points.map((pt, i) => (
        <ErrorBars key={`e${i}`} p={p} s={s} pt={pt} />
      ))}
      {/* đường nối */}
      {s.lineStyle !== "none" && s.points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke={s.color}
          strokeWidth={s.lineWidth}
          strokeDasharray={dashArray(s.lineStyle, s.lineWidth)}
        />
      )}
      {/* markers */}
      {s.points.map((pt, i) => {
        const cx = scaleX(p, pt.x);
        const cy = scaleY(p, pt.y);
        const sel = isPointSelected(ed.selected, p.id, s.id, i);
        return (
          <g key={`m${i}`}>
            <Marker
              shape={s.marker}
              cx={cx}
              cy={cy}
              size={s.markerSize}
              color={s.color}
              filled={pt.filled ?? s.markerFilled}
            />
            {sel && (
              <circle cx={cx} cy={cy} r={s.markerSize / 2 + 4} fill="none" stroke={SEL_COLOR} strokeWidth={2} />
            )}
            {/* vùng bắt click (trong suốt, rộng hơn để dễ chọn/kéo) */}
            {ed.editable && (
              <circle
                cx={cx}
                cy={cy}
                r={Math.max(s.markerSize / 2, 8)}
                fill="transparent"
                style={{ cursor: "move" }}
                onPointerDown={(e) => ed.beginDragPoint(e, p.id, s.id, i)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// Vẽ các bar series theo NHÓM: trong 1 băng category, N series chia đều slot cạnh nhau.
function BarGroups({ p, bars }: { p: Panel; bars: Series[] }) {
  const ed = useContext(EditorContext);
  if (bars.length === 0) return null;
  const orientation = bars[0].barOrientation ?? "vertical";
  const n = bars.length;
  const cap = 4;

  if (orientation === "horizontal") {
    // category trên trục Y, giá trị (độ dài thanh) trên trục X
    const group = bandSize(p.yAxis, p.plotArea.height) * 0.8;
    const thick = group / n;
    const x0 = scaleX(p, Math.max(0, p.xAxis.min));
    return (
      <g>
        {bars.map((s, j) =>
          s.points.map((pt, i) => {
            const c = scaleY(p, pt.y);
            const top = c - group / 2 + j * thick;
            const xEnd = scaleX(p, pt.x);
            const midY = top + thick / 2;
            const filled = pt.filled ?? s.markerFilled;
            const err: JSX.Element[] = [];
            if (pt.errorPlus || pt.errorMinus) {
              const xR = scaleX(p, pt.x + (pt.errorPlus ?? 0));
              const xL = scaleX(p, pt.x - (pt.errorMinus ?? 0));
              err.push(<line key="eh" x1={xL} y1={midY} x2={xR} y2={midY} stroke="#000" strokeWidth={1} />);
              err.push(<line key="el" x1={xL} y1={midY - cap} x2={xL} y2={midY + cap} stroke="#000" strokeWidth={1} />);
              err.push(<line key="er" x1={xR} y1={midY - cap} x2={xR} y2={midY + cap} stroke="#000" strokeWidth={1} />);
            }
            const sel = isPointSelected(ed.selected, p.id, s.id, i);
            return (
              <g key={`${s.id}-${i}`}>
                <rect
                  x={Math.min(x0, xEnd)}
                  y={top}
                  width={Math.abs(xEnd - x0)}
                  height={thick * 0.9}
                  fill={filled ? s.color : "#FFFFFF"}
                  stroke={sel ? SEL_COLOR : s.color}
                  strokeWidth={sel ? 2.5 : 1}
                  style={ed.editable ? { cursor: "ew-resize" } : undefined}
                  onPointerDown={
                    ed.editable ? (e) => ed.beginDragPoint(e, p.id, s.id, i) : undefined
                  }
                />
                {err}
              </g>
            );
          })
        )}
      </g>
    );
  }

  // vertical: category trên trục X, giá trị trên trục Y
  const group = bandSize(p.xAxis, p.plotArea.width) * 0.8;
  const thick = group / n;
  const y0 = scaleY(p, Math.max(0, p.yAxis.min));
  return (
    <g>
      {bars.map((s, j) =>
        s.points.map((pt, i) => {
          const c = scaleX(p, pt.x);
          const left = c - group / 2 + j * thick;
          const yEnd = scaleY(p, pt.y);
          const midX = left + thick / 2;
          const filled = pt.filled ?? s.markerFilled;
          const err: JSX.Element[] = [];
          if (pt.errorPlus || pt.errorMinus) {
            const yT = scaleY(p, pt.y + (pt.errorPlus ?? 0));
            const yB = scaleY(p, pt.y - (pt.errorMinus ?? 0));
            err.push(<line key="ev" x1={midX} y1={yT} x2={midX} y2={yB} stroke="#000" strokeWidth={1} />);
            err.push(<line key="et" x1={midX - cap} y1={yT} x2={midX + cap} y2={yT} stroke="#000" strokeWidth={1} />);
            err.push(<line key="eb" x1={midX - cap} y1={yB} x2={midX + cap} y2={yB} stroke="#000" strokeWidth={1} />);
          }
          const sel = isPointSelected(ed.selected, p.id, s.id, i);
          return (
            <g key={`${s.id}-${i}`}>
              <rect
                x={left}
                y={Math.min(y0, yEnd)}
                width={thick * 0.9}
                height={Math.abs(yEnd - y0)}
                fill={filled ? s.color : "#FFFFFF"}
                stroke={sel ? SEL_COLOR : s.color}
                strokeWidth={sel ? 2.5 : 1}
                style={ed.editable ? { cursor: "ns-resize" } : undefined}
                onPointerDown={
                  ed.editable ? (e) => ed.beginDragPoint(e, p.id, s.id, i) : undefined
                }
              />
              {err}
            </g>
          );
        })
      )}
    </g>
  );
}

function LegendRenderer({ p, lg }: { p: Panel; lg: Legend }) {
  const { bounds: b } = lg;
  const rowH = lg.fontSize + 8;
  const sampleX = b.x + 10;
  const labelX = b.x + 44;

  const findRef = (id: string) =>
    p.series.find((s) => s.id === id) ?? p.referenceLines.find((r) => r.id === id);

  return (
    <g fontFamily={lg.fontFamily} fontSize={lg.fontSize}>
      {lg.showBorder && (
        <rect
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          fill={lg.background === "transparent" ? "none" : lg.background}
          stroke="#000"
          strokeWidth={1}
        />
      )}
      {lg.entries.map((entry, i) => {
        const cy = b.y + 12 + i * rowH;
        const ref = findRef(entry.refId);
        if (!ref) return null;
        const isSeries = "points" in ref;
        const color = ref.color;
        const lineStyle = ref.lineStyle;
        const lineWidth = (ref as any).lineWidth ?? 1.5;
        const isBar = isSeries && (ref as Series).kind === "bar";
        return (
          <g key={entry.refId + i}>
            {isBar ? (
              /* mẫu ô vuông cho bar series */
              <rect
                x={sampleX}
                y={cy - 7}
                width={26}
                height={14}
                fill={(ref as Series).markerFilled ? color : "#FFFFFF"}
                stroke={color}
                strokeWidth={1}
              />
            ) : (
              <>
                {/* mẫu đường */}
                {lineStyle !== "none" && (
                  <line
                    x1={sampleX}
                    y1={cy}
                    x2={sampleX + 26}
                    y2={cy}
                    stroke={color}
                    strokeWidth={lineWidth}
                    strokeDasharray={dashArray(lineStyle, lineWidth)}
                  />
                )}
                {/* mẫu marker (chỉ line series) */}
                {isSeries && (ref as Series).marker !== "none" && (
                  <Marker
                    shape={(ref as Series).marker}
                    cx={sampleX + 13}
                    cy={cy}
                    size={(ref as Series).markerSize}
                    color={color}
                    filled={(ref as Series).markerFilled}
                  />
                )}
              </>
            )}
            <text x={labelX} y={cy + 4} fill="#000">
              {entry.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function TextRenderer({ t }: { t: TextSpec }) {
  const ed = useContext(EditorContext);
  const sel = !!ed.selected && ed.selected.kind === "text" && ed.selected.id === t.id;
  return (
    <text
      x={t.x}
      y={t.y}
      textAnchor={t.anchor}
      fontSize={t.fontSize}
      fontFamily={t.fontFamily}
      fontWeight={t.fontWeight}
      fontStyle={t.fontStyle}
      fill={sel ? SEL_COLOR : t.color}
      transform={t.rotation ? `rotate(${t.rotation} ${t.x} ${t.y})` : undefined}
      style={ed.editable ? { cursor: "move" } : undefined}
      onPointerDown={ed.editable ? (e) => ed.beginDragText(e, t.id) : undefined}
    >
      {t.content}
    </text>
  );
}

function PanelRenderer({ p }: { p: Panel }) {
  return (
    <g>
      {p.title && <TextRenderer t={p.title} />}
      <AxesAndGrid p={p} />
      {p.referenceLines.map((r) => (
        <RefLine key={r.id} p={p} r={r} />
      ))}
      {/* bar vẽ theo nhóm (cần biết tất cả bar series cùng lúc để chia slot) */}
      <BarGroups p={p} bars={p.series.filter((s) => s.kind === "bar")} />
      {/* line/scatter vẽ từng series */}
      {p.series
        .filter((s) => s.kind !== "bar")
        .map((s) => (
          <SeriesRenderer key={s.id} p={p} s={s} />
        ))}
      {p.legends.map((lg) => (
        <LegendRenderer key={lg.id} p={p} lg={lg} />
      ))}
      {/* inset đệ quy */}
      {p.insets.map((ins) => (
        <PanelRenderer key={ins.id} p={ins} />
      ))}
    </g>
  );
}

// Loại các freeText trùng với nhãn trục / số tick / tiêu đề panel (nguồn gây chữ đè 2 lần).
function dedupeFreeTexts(doc: ChartDocument): TextSpec[] {
  const reserved = new Set<string>();
  for (const p of walkPanels(doc)) {
    reserved.add(p.xAxis.label.trim());
    reserved.add(p.yAxis.label.trim());
    if (p.title) reserved.add(p.title.content.trim());
    p.xAxis.ticks.forEach((t) => reserved.add(fmtTick(t, p.xAxis.tickFormat)));
    p.yAxis.ticks.forEach((t) => reserved.add(fmtTick(t, p.yAxis.tickFormat)));
  }
  const seen = new Set<string>();
  return doc.freeTexts.filter((t) => {
    const c = t.content.trim();
    if (reserved.has(c)) return false; // trùng nhãn trục/tick/title
    if (seen.has(c)) return false; // trùng chính freeText khác
    seen.add(c);
    return true;
  });
}

export function ChartSvg({
  doc,
  svgRef,
  onChange,
  selected = null,
  onSelect,
}: {
  doc: ChartDocument;
  svgRef?: React.Ref<SVGSVGElement>;
  onChange?: (d: ChartDocument) => void; // có => bật chế độ chỉnh sửa
  selected?: Selection | null;
  onSelect?: (s: Selection | null) => void;
}) {
  const editable = !!onChange && !!onSelect;
  const innerRef = useRef<SVGSVGElement | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;

  // client px -> toạ độ trong hệ viewBox của SVG (xử lý cả khi SVG bị scale để fit).
  const toSvg = (clientX: number, clientY: number) => {
    const svg = innerRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  };

  const beginDragPoint: EditorCtx["beginDragPoint"] = (e, panelId, seriesId, index) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect!({ kind: "point", panelId, seriesId, index });
    const move = (ev: PointerEvent) => {
      const sp = toSvg(ev.clientX, ev.clientY);
      const cur = structuredClone(docRef.current);
      const p = findPanel(cur, panelId);
      const s = p?.series.find((x) => x.id === seriesId);
      if (!p || !s) return;
      const pt = s.points[index];
      const a = p.plotArea;
      if (s.kind === "bar") {
        if ((s.barOrientation ?? "vertical") === "horizontal") {
          pt.x = clampAxis(p.xAxis, invLinear(p.xAxis, a.x, a.width, sp.x, false));
        } else {
          pt.y = clampAxis(p.yAxis, invLinear(p.yAxis, a.y, a.height, sp.y, true));
        }
      } else {
        if (p.xAxis.type !== "category")
          pt.x = invLinear(p.xAxis, a.x, a.width, sp.x, false);
        if (p.yAxis.type !== "category")
          pt.y = invLinear(p.yAxis, a.y, a.height, sp.y, true);
      }
      onChange!(cur);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginDragText: EditorCtx["beginDragText"] = (e, id) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect!({ kind: "text", id });
    const move = (ev: PointerEvent) => {
      const sp = toSvg(ev.clientX, ev.clientY);
      const cur = structuredClone(docRef.current);
      let t = cur.freeTexts.find((x) => x.id === id);
      if (!t) for (const p of cur.panels) if (p.title?.id === id) t = p.title;
      if (!t) return;
      t.x = round2(sp.x);
      t.y = round2(sp.y);
      onChange!(cur);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ctx: EditorCtx = {
    editable,
    selected,
    select: onSelect ?? noop,
    beginDragPoint,
    beginDragText,
  };

  return (
    <EditorContext.Provider value={ctx}>
      <svg
        ref={(el) => {
          innerRef.current = el;
          if (typeof svgRef === "function") svgRef(el);
          else if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
        }}
        xmlns="http://www.w3.org/2000/svg"
        width={doc.width}
        height={doc.height}
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        fontFamily={doc.defaultFontFamily}
        style={{ background: doc.background, maxWidth: "100%", height: "auto" }}
      >
        {/* nền: click để bỏ chọn */}
        <rect
          x={0}
          y={0}
          width={doc.width}
          height={doc.height}
          fill={doc.background}
          onPointerDown={editable ? () => onSelect!(null) : undefined}
        />
        {doc.panels.map((p) => (
          <PanelRenderer key={p.id} p={p} />
        ))}
        {/* Bỏ freeText trùng nhãn trục / tick / tiêu đề (Gemini hay nhét bản sao gây đè chữ). */}
        {dedupeFreeTexts(doc).map((t) => (
          <TextRenderer key={t.id} t={t} />
        ))}
      </svg>
    </EditorContext.Provider>
  );
}
