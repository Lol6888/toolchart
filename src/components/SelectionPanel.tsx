import type { ChartDocument, Series, DataPoint } from "../types/chart";
import { type Selection, findPanel, walkPanels, uid } from "../editor/util";

export function SelectionPanel({
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
  const update = (mut: (d: ChartDocument) => void) => {
    const next = structuredClone(doc);
    mut(next);
    onChange(next);
  };

  // Panel mục tiêu cho "thêm series": panel của phần tử đang chọn, hoặc panel đầu.
  const targetPanelId =
    selected?.kind === "point" ? selected.panelId : walkPanels(doc)[0]?.id;

  const addSeries = (kind: "bar" | "line") => {
    update((d) => {
      const p = findPanel(d, targetPanelId!);
      if (!p) return;
      const midX = (p.xAxis.min + p.xAxis.max) / 2;
      const midY = (p.yAxis.min + p.yAxis.max) / 2;
      const catY = p.yAxis.type === "category" ? p.yAxis.ticks[0] : midY;
      const catX = p.xAxis.type === "category" ? p.xAxis.ticks[0] : midX;
      const ns: Series = {
        id: uid("s"),
        name: kind === "bar" ? "Series bar mới" : "Series line mới",
        color: "#888888",
        marker: kind === "bar" ? "none" : "circle",
        markerFilled: true,
        markerSize: kind === "bar" ? 0 : 10,
        lineStyle: kind === "bar" ? "none" : "solid",
        lineWidth: kind === "bar" ? 0 : 2,
        showInLegend: false,
        kind,
        barOrientation: kind === "bar" ? "horizontal" : undefined,
        points: [
          kind === "bar"
            ? { x: p.xAxis.type === "category" ? catX : midX, y: catY }
            : { x: catX, y: midY },
        ],
      };
      p.series.push(ns);
      onSelect({ kind: "point", panelId: p.id, seriesId: ns.id, index: 0 });
    });
  };

  return (
    <div className="edit-panel">
      <h3>Phần tử đang chọn</h3>

      {selected?.kind === "point" ? (
        <PointEditor doc={doc} selected={selected} update={update} onSelect={onSelect} />
      ) : selected?.kind === "text" ? (
        <p className="hint">Đang chọn 1 nhãn chữ. Kéo để di chuyển; sửa nội dung/font ở tab dưới.</p>
      ) : (
        <p className="hint">Bấm vào 1 thanh, điểm, hoặc chữ trên biểu đồ để chọn. Kéo để chỉnh.</p>
      )}

      <div className="add-series">
        <button className="btn ghost sm" onClick={() => addSeries("bar")}>+ Series bar</button>
        <button className="btn ghost sm" onClick={() => addSeries("line")}>+ Series line</button>
      </div>
    </div>
  );
}

function PointEditor({
  doc,
  selected,
  update,
  onSelect,
}: {
  doc: ChartDocument;
  selected: Extract<Selection, { kind: "point" }>;
  update: (mut: (d: ChartDocument) => void) => void;
  onSelect: (s: Selection | null) => void;
}) {
  const panel = findPanel(doc, selected.panelId);
  const series = panel?.series.find((s) => s.id === selected.seriesId);
  const pt = series?.points[selected.index];
  if (!panel || !series || !pt) return <p className="hint">Điểm không còn tồn tại.</p>;

  const isBar = series.kind === "bar";
  const horizontal = (series.barOrientation ?? "vertical") === "horizontal";

  const editPoint = (mut: (p: DataPoint) => void) =>
    update((d) => {
      const s = findPanel(d, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      const target = s?.points[selected.index];
      if (target) mut(target);
    });

  const editSeries = (mut: (s: Series) => void) =>
    update((d) => {
      const s = findPanel(d, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      if (s) mut(s);
    });

  const num = (v: number | undefined) => (v === undefined ? "" : String(v));
  const parse = (s: string) => (s === "" ? undefined : Number(s));

  const deletePoint = () =>
    update((d) => {
      const s = findPanel(d, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      s?.points.splice(selected.index, 1);
      onSelect(null);
    });

  const duplicatePoint = () =>
    update((d) => {
      const s = findPanel(d, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      if (!s) return;
      const copy = structuredClone(s.points[selected.index]);
      s.points.splice(selected.index + 1, 0, copy);
      onSelect({ ...selected, index: selected.index + 1 });
    });

  const addPoint = () =>
    update((d) => {
      const s = findPanel(d, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      if (!s) return;
      const last = s.points[s.points.length - 1];
      s.points.push(last ? { ...structuredClone(last) } : { x: 0, y: 0 });
      onSelect({ ...selected, index: s.points.length - 1 });
    });

  const deleteSeries = () =>
    update((d) => {
      const p = findPanel(d, selected.panelId);
      if (!p) return;
      p.series = p.series.filter((x) => x.id !== selected.seriesId);
      onSelect(null);
    });

  const duplicateSeries = () =>
    update((d) => {
      const p = findPanel(d, selected.panelId);
      const s = p?.series.find((x) => x.id === selected.seriesId);
      if (!p || !s) return;
      const copy = structuredClone(s);
      copy.id = uid("s");
      copy.name = s.name + " (copy)";
      p.series.push(copy);
      onSelect({ kind: "point", panelId: p.id, seriesId: copy.id, index: selected.index });
    });

  return (
    <div>
      <div className="sel-head">
        <span className="swatch" style={{ background: series.color }} />
        <input
          className="series-name"
          value={series.name}
          onChange={(e) => editSeries((s) => (s.name = e.target.value))}
        />
      </div>
      <div className="hint sm">
        {isBar ? (horizontal ? "Thanh ngang" : "Thanh dọc") : "Điểm line"} · điểm #{selected.index + 1}/
        {series.points.length}
      </div>

      <div className="num-grid">
        {/* pt.x luôn là toạ độ trục X, pt.y là trục Y — chỉ đổi nhãn theo loại.
            Bar ngang: giá trị=x, category=y. Bar dọc: category=x, giá trị=y. */}
        <label>
          {isBar ? (horizontal ? "Giá trị (X)" : "Category (X)") : "X"}
          <input type="number" value={num(pt.x)} onChange={(e) => editPoint((p) => (p.x = Number(e.target.value)))} />
        </label>
        <label>
          {isBar ? (horizontal ? "Category (Y)" : "Giá trị (Y)") : "Y"}
          <input type="number" value={num(pt.y)} onChange={(e) => editPoint((p) => (p.y = Number(e.target.value)))} />
        </label>
        <label>
          Err + ({isBar ? "giá trị" : "Y"})
          <input type="number" value={num(pt.errorPlus)} onChange={(e) => editPoint((p) => (p.errorPlus = parse(e.target.value)))} />
        </label>
        <label>
          Err −
          <input type="number" value={num(pt.errorMinus)} onChange={(e) => editPoint((p) => (p.errorMinus = parse(e.target.value)))} />
        </label>
      </div>

      <label className="chk">
        <input
          type="checkbox"
          checked={pt.filled ?? series.markerFilled}
          onChange={(e) => editPoint((p) => (p.filled = e.target.checked))}
        />
        Tô đặc (bỏ chọn = viền trắng)
      </label>

      <div className="btn-row">
        <button className="btn sm" onClick={addPoint}>+ Điểm</button>
        <button className="btn ghost sm" onClick={duplicatePoint}>Nhân đôi</button>
        <button className="btn danger sm" onClick={deletePoint}>Xoá điểm</button>
      </div>
      <div className="btn-row">
        <button className="btn ghost sm" onClick={duplicateSeries}>Nhân đôi series</button>
        <button className="btn danger sm" onClick={deleteSeries}>Xoá series</button>
      </div>
    </div>
  );
}
