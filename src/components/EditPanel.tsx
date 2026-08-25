import type { ChartDocument, Panel, Series, MarkerShape, LineStyle } from "../types/chart";

const MARKERS: MarkerShape[] = ["circle", "square", "triangle", "diamond", "none"];
const LINES: LineStyle[] = ["solid", "dashed", "dotted", "none"];
const FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Calibri", "Verdana"];

export function EditPanel({
  doc,
  onChange,
}: {
  doc: ChartDocument;
  onChange: (d: ChartDocument) => void;
}) {
  // Mọi update: clone sâu rồi mutate cho gọn (doc không quá lớn).
  const update = (mutator: (d: ChartDocument) => void) => {
    const next = structuredClone(doc);
    mutator(next);
    onChange(next);
  };

  const allPanels: Panel[] = [];
  const collect = (p: Panel) => {
    allPanels.push(p);
    p.insets.forEach(collect);
  };
  doc.panels.forEach(collect);

  return (
    <div className="edit-panel">
      <h3>Chỉnh sửa</h3>

      <section>
        <label className="field">
          <span>Font mặc định</span>
          <select
            value={doc.defaultFontFamily}
            onChange={(e) => update((d) => (d.defaultFontFamily = e.target.value))}
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      </section>

      {allPanels.map((panel) => (
        <details key={panel.id} className="panel-block" open>
          <summary>{panel.title?.content ?? panel.id}</summary>

          {panel.title && (
            <label className="field">
              <span>Tiêu đề</span>
              <input
                value={panel.title.content}
                onChange={(e) =>
                  update((d) => {
                    const p = findPanel(d, panel.id);
                    if (p?.title) p.title.content = e.target.value;
                  })
                }
              />
            </label>
          )}
          <label className="field">
            <span>Nhãn trục X</span>
            <input
              value={panel.xAxis.label}
              onChange={(e) =>
                update((d) => {
                  const p = findPanel(d, panel.id);
                  if (p) p.xAxis.label = e.target.value;
                })
              }
            />
          </label>
          <label className="field">
            <span>Nhãn trục Y</span>
            <input
              value={panel.yAxis.label}
              onChange={(e) =>
                update((d) => {
                  const p = findPanel(d, panel.id);
                  if (p) p.yAxis.label = e.target.value;
                })
              }
            />
          </label>

          {panel.series.map((s) => (
            <SeriesEditor
              key={s.id}
              s={s}
              onEdit={(mut) =>
                update((d) => {
                  const p = findPanel(d, panel.id);
                  const target = p?.series.find((x) => x.id === s.id);
                  if (target) mut(target);
                })
              }
            />
          ))}
        </details>
      ))}
    </div>
  );
}

function SeriesEditor({ s, onEdit }: { s: Series; onEdit: (m: (s: Series) => void) => void }) {
  return (
    <div className="series-editor">
      <div className="series-head">
        <span className="swatch" style={{ background: s.color }} />
        <input
          className="series-name"
          value={s.name}
          onChange={(e) => onEdit((x) => (x.name = e.target.value))}
        />
      </div>
      <div className="series-controls">
        <label>
          Màu
          <input type="color" value={s.color} onChange={(e) => onEdit((x) => (x.color = e.target.value))} />
        </label>
        <label>
          Marker
          <select value={s.marker} onChange={(e) => onEdit((x) => (x.marker = e.target.value as MarkerShape))}>
            {MARKERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          Nét
          <select value={s.lineStyle} onChange={(e) => onEdit((x) => (x.lineStyle = e.target.value as LineStyle))}>
            {LINES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="chk">
          <input type="checkbox" checked={s.markerFilled} onChange={(e) => onEdit((x) => (x.markerFilled = e.target.checked))} />
          Tô đặc
        </label>
      </div>
    </div>
  );
}

function findPanel(d: ChartDocument, id: string): Panel | undefined {
  let found: Panel | undefined;
  const walk = (p: Panel) => {
    if (p.id === id) found = p;
    p.insets.forEach(walk);
  };
  d.panels.forEach(walk);
  return found;
}
