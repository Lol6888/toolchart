// Cây phần tử bên trái: biểu đồ → trục, series, tiêu đề; chữ tự do. Bấm để chọn
// (tiện cho phần tử khó bấm trên canvas, vd histogram hàng trăm vạch).
import type { ChartDocument, Panel, Series } from "../types/chart";
import { type Selection, findPanel, walkPanels, uid } from "../editor/util";
import { Icon } from "./Icon";
import { kindLabel } from "./Inspector";

export function LayersPanel({
  doc,
  selected,
  onChange,
  onSelect,
}: {
  doc: ChartDocument;
  selected: Selection | null;
  onChange: (d: ChartDocument) => void;
  onSelect: (s: Selection | null) => void;
}) {
  const isSel = (s: Selection) => {
    if (!selected) return false;
    if (s.kind === "series") return (selected.kind === "series" || selected.kind === "point") && selected.seriesId === s.seriesId && selected.panelId === s.panelId;
    return JSON.stringify(s) === JSON.stringify(selected);
  };
  const row = (s: Selection, icon: JSX.Element, label: string, meta?: string, depth = 0) => (
    <button
      key={JSON.stringify(s)}
      className={"layer" + (isSel(s) ? " on" : "")}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={() => onSelect(s)}
      title={label}
    >
      {icon}
      <span className="grow ellipsis">{label}</span>
      {meta && <span className="layer-meta">{meta}</span>}
    </button>
  );

  // Panel đích khi thêm: panel của phần tử đang chọn, không thì panel đầu.
  const targetPanelId =
    selected && selected.kind !== "text" ? selected.panelId : walkPanels(doc)[0]?.id;

  const addSeries = (kind: "line" | "bar") => {
    const next = structuredClone(doc);
    const p = targetPanelId ? findPanel(next, targetPanelId) : undefined;
    if (!p) return;
    const midX = (p.xAxis.min + p.xAxis.max) / 2;
    const midY = (p.yAxis.min + p.yAxis.max) / 2;
    const catX = p.xAxis.type === "category" ? p.xAxis.ticks[0] ?? midX : midX;
    const catY = p.yAxis.type === "category" ? p.yAxis.ticks[0] ?? midY : midY;
    const horizontal = p.yAxis.type === "category";
    const ns: Series = {
      id: uid("s"),
      name: kind === "bar" ? "Series thanh mới" : "Series đường mới",
      color: "#888888",
      marker: kind === "bar" ? "none" : "circle",
      markerFilled: true,
      markerSize: kind === "bar" ? 0 : 8,
      lineStyle: kind === "bar" ? "none" : "solid",
      lineWidth: kind === "bar" ? 0 : 2,
      showInLegend: false,
      kind,
      barOrientation: kind === "bar" ? (horizontal ? "horizontal" : "vertical") : undefined,
      points: [{ x: catX, y: catY }],
    };
    p.series.push(ns);
    onChange(next);
    onSelect({ kind: "point", panelId: p.id, seriesId: ns.id, index: 0 });
  };

  const addText = () => {
    const next = structuredClone(doc);
    const id = uid("t");
    next.freeTexts.push({
      id,
      content: "Chữ mới",
      x: doc.width / 2,
      y: doc.height / 2,
      fontSize: Math.max(12, Math.round(doc.width / 60)),
      fontFamily: doc.defaultFontFamily,
      fontWeight: "normal",
      fontStyle: "normal",
      color: "#000000",
      anchor: "middle",
      rotation: 0,
    });
    onChange(next);
    onSelect({ kind: "text", id });
  };

  const renderPanel = (p: Panel, depth: number, n: number): JSX.Element[] => {
    const out: JSX.Element[] = [
      <div key={"h" + p.id} className="layer-group" style={{ paddingLeft: 10 + depth * 14 }}>
        {depth > 0 ? "Biểu đồ lồng" : `Biểu đồ ${n}`}
      </div>,
    ];
    const d = depth + 1;
    if (p.title) out.push(row({ kind: "text", id: p.title.id }, <Icon name="text" size={14} />, p.title.content || "(tiêu đề trống)", "tiêu đề", d));
    out.push(row({ kind: "axis", panelId: p.id, axis: "x" }, <Icon name="axis" size={14} />, `Trục X${p.xAxis.label ? ": " + p.xAxis.label : ""}`, undefined, d));
    out.push(row({ kind: "axis", panelId: p.id, axis: "y" }, <Icon name="axis" size={14} />, `Trục Y${p.yAxis.label ? ": " + p.yAxis.label : ""}`, undefined, d));
    // Vẽ sau = nằm trên, nên liệt kê ngược (trên cùng danh sách = trên cùng hình) như các tool đồ hoạ.
    [...p.series].reverse().forEach((s) =>
      out.push(
        row(
          { kind: "series", panelId: p.id, seriesId: s.id },
          <span className="swatch" style={{ background: s.color }} />,
          s.name || "(không tên)",
          `${kindLabel(s)} · ${s.points.length}`,
          d
        )
      )
    );
    p.insets.forEach((ins) => out.push(...renderPanel(ins, d, 0)));
    return out;
  };

  return (
    <div className="layers">
      <div className="side-head">
        <span>Thành phần</span>
      </div>
      <div className="layer-list">
        {doc.panels.flatMap((p, i) => renderPanel(p, 0, i + 1))}
        {doc.freeTexts.length > 0 && <div className="layer-group">Chữ tự do</div>}
        {doc.freeTexts.map((t) => row({ kind: "text", id: t.id }, <Icon name="text" size={14} />, t.content || "(trống)", undefined, 1))}
      </div>
      <div className="layer-add">
        <span className="muted">Thêm vào biểu đồ đang chọn</span>
        <div className="btn-row">
          <button className="btn sm" onClick={() => addSeries("line")}>
            <Icon name="series" size={14} /> Đường
          </button>
          <button className="btn sm" onClick={() => addSeries("bar")}>
            <Icon name="bars" size={14} /> Thanh
          </button>
          <button className="btn sm" onClick={addText}>
            <Icon name="text" size={14} /> Chữ
          </button>
        </div>
      </div>
    </div>
  );
}
