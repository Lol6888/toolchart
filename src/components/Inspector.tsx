// Inspector bên phải: hiện thuộc tính của thứ đang chọn (điểm, series, trục, chữ) hoặc của cả document.
import type { ChartDocument, Panel, Series, DataPoint, Axis, TextSpec, MarkerShape, LineStyle } from "../types/chart";
import { type Selection, findPanel, walkPanels, uid, densifyPoints } from "../editor/util";
import { Icon } from "./Icon";
import { Section, Field, NumInput, ListInput, TextInput, ColorInput, SelectInput, Segmented, Check } from "./ui";

type Update = (mut: (d: ChartDocument) => void) => void;

const MARKERS: { value: MarkerShape; label: string }[] = [
  { value: "circle", label: "● Tròn" },
  { value: "square", label: "■ Vuông" },
  { value: "triangle", label: "▲ Tam giác" },
  { value: "diamond", label: "◆ Thoi" },
  { value: "none", label: "Không" },
];
const LINES: { value: LineStyle; label: string }[] = [
  { value: "solid", label: "Liền" },
  { value: "dashed", label: "Gạch" },
  { value: "dotted", label: "Chấm" },
  { value: "none", label: "Không" },
];
const FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Calibri", "Verdana"];

export function kindLabel(s: Series): string {
  if (s.kind === "bar") return (s.barOrientation ?? "vertical") === "horizontal" ? "Thanh ngang" : "Thanh dọc";
  if (s.kind === "stem") return "Histogram";
  return s.lineStyle === "none" ? "Điểm (scatter)" : "Đường";
}

// Tìm TextSpec theo id: chữ tự do hoặc tiêu đề panel (kể cả inset).
export function findText(d: ChartDocument, id: string): TextSpec | undefined {
  return d.freeTexts.find((t) => t.id === id) ?? walkPanels(d).find((p) => p.title?.id === id)?.title ?? undefined;
}

export function Inspector({
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
  const update: Update = (mut) => {
    const next = structuredClone(doc);
    mut(next);
    onChange(next);
  };

  let body: JSX.Element;
  if (selected?.kind === "point" || selected?.kind === "series") {
    body = <SeriesInspector key={selected.seriesId} doc={doc} sel={selected} update={update} onSelect={onSelect} />;
  } else if (selected?.kind === "axis") {
    body = <AxisInspector key={selected.panelId + selected.axis} doc={doc} sel={selected} update={update} />;
  } else if (selected?.kind === "text") {
    body = <TextInspector key={selected.id} doc={doc} id={selected.id} update={update} onSelect={onSelect} />;
  } else {
    body = <DocInspector doc={doc} update={update} />;
  }
  return <div className="inspector">{body}</div>;
}

// ---------------- Document ----------------
function DocInspector({ doc, update }: { doc: ChartDocument; update: Update }) {
  const panels = walkPanels(doc);
  const nSeries = panels.reduce((n, p) => n + p.series.length, 0);
  const nPoints = panels.reduce((n, p) => n + p.series.reduce((m, s) => m + s.points.length, 0), 0);
  return (
    <>
      <div className="insp-title">
        <Icon name="image" />
        <span>Tài liệu</span>
      </div>
      <p className="insp-empty">Bấm vào đường, điểm, trục hoặc chữ trên biểu đồ (hoặc trong danh sách bên trái) để chỉnh.</p>
      <Section title="Trang">
        <div className="grid2">
          <Field label="Nền">
            <ColorInput value={doc.background} onChange={(v) => update((d) => (d.background = v))} />
          </Field>
          <Field label="Kích thước">
            <span className="readonly">
              {Math.round(doc.width)} × {Math.round(doc.height)} px
            </span>
          </Field>
        </div>
        <Field label="Font mặc định">
          <SelectInput
            value={doc.defaultFontFamily}
            options={[...new Set([doc.defaultFontFamily, ...FONTS])].map((f) => ({ value: f, label: f }))}
            onChange={(v) => update((d) => (d.defaultFontFamily = v))}
          />
        </Field>
      </Section>
      <Section title="Thống kê">
        <ul className="stats">
          <li><b>{panels.length}</b> biểu đồ</li>
          <li><b>{nSeries}</b> series</li>
          <li><b>{nPoints}</b> điểm dữ liệu</li>
          <li><b>{doc.freeTexts.length}</b> chữ tự do</li>
        </ul>
      </Section>
    </>
  );
}

// ---------------- Series (+ điểm đang chọn) ----------------
function SeriesInspector({
  doc,
  sel,
  update,
  onSelect,
}: {
  doc: ChartDocument;
  sel: Extract<Selection, { kind: "point" | "series" }>;
  update: Update;
  onSelect: (s: Selection | null) => void;
}) {
  const panel = findPanel(doc, sel.panelId);
  const series = panel?.series.find((s) => s.id === sel.seriesId);
  if (!panel || !series) return <p className="insp-empty">Series không còn tồn tại.</p>;

  const editSeries = (mut: (s: Series) => void) =>
    update((d) => {
      const s = findPanel(d, sel.panelId)?.series.find((x) => x.id === sel.seriesId);
      if (s) mut(s);
    });
  const editPanel = (mut: (p: Panel) => void) =>
    update((d) => {
      const p = findPanel(d, sel.panelId);
      if (p) mut(p);
    });

  const idx = panel.series.indexOf(series);
  const isBar = series.kind === "bar";
  const isStem = series.kind === "stem";

  const move = (dir: -1 | 1) =>
    editPanel((p) => {
      const j = idx + dir;
      if (j < 0 || j >= p.series.length) return;
      [p.series[idx], p.series[j]] = [p.series[j], p.series[idx]];
    });

  return (
    <>
      <div className="insp-title">
        <span className="swatch" style={{ background: series.color }} />
        <span className="grow ellipsis">{series.name || "(không tên)"}</span>
        <span className="badge">{kindLabel(series)}</span>
      </div>

      {sel.kind === "point" && (
        <PointSection key={sel.index} panel={panel} series={series} index={sel.index} update={update} onSelect={onSelect} />
      )}

      <Section title="Series">
        <Field label="Tên">
          <TextInput value={series.name} onChange={(v) => editSeries((s) => (s.name = v))} />
        </Field>
        <div className="grid2">
          <Field label="Màu">
            <ColorInput value={series.color} onChange={(v) => editSeries((s) => (s.color = v))} />
          </Field>
          {isBar ? (
            <Field label="Kiểu thanh">
              <Segmented
                value={series.markerFilled ? "fill" : "outline"}
                options={[
                  { value: "fill", label: "Tô đặc" },
                  { value: "outline", label: "Viền" },
                ]}
                onChange={(v) => editSeries((s) => (s.markerFilled = v === "fill"))}
              />
            </Field>
          ) : (
            <Field label={isStem ? "Độ rộng vạch" : "Độ dày nét"}>
              <NumInput value={round(series.lineWidth)} step={0.5} onChange={(v) => editSeries((s) => (s.lineWidth = Math.max(0, v ?? 0)))} />
            </Field>
          )}
        </div>

        {!isBar && !isStem && (
          <>
            <Field label="Kiểu nét">
              <Segmented value={series.lineStyle} options={LINES} onChange={(v) => editSeries((s) => (s.lineStyle = v))} />
            </Field>
            <div className="grid2">
              <Field label="Marker">
                <SelectInput value={series.marker} options={MARKERS} onChange={(v) => editSeries((s) => (s.marker = v))} />
              </Field>
              <Field label="Cỡ marker">
                <NumInput value={series.markerSize} step={1} onChange={(v) => editSeries((s) => (s.markerSize = Math.max(0, v ?? 0)))} />
              </Field>
            </div>
            {series.marker !== "none" && (
              <Check label="Marker tô đặc (bỏ = viền trắng)" checked={series.markerFilled} onChange={(v) => editSeries((s) => (s.markerFilled = v))} />
            )}
            <Check label="Đường cong mượt" checked={!!series.smooth} onChange={(v) => editSeries((s) => (s.smooth = v || undefined))} />
            <Check
              label="Tô vùng dưới đường"
              checked={!!series.areaFill}
              onChange={(v) => editSeries((s) => (s.areaFill = v ? { color: s.color, opacity: 0.3 } : undefined))}
            />
            {series.areaFill && (
              <div className="grid2 indent">
                <Field label="Màu tô">
                  <ColorInput value={series.areaFill.color} onChange={(v) => editSeries((s) => s.areaFill && (s.areaFill.color = v))} />
                </Field>
                <Field label={`Độ đậm ${Math.round(series.areaFill.opacity * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={series.areaFill.opacity}
                    onChange={(e) => editSeries((s) => s.areaFill && (s.areaFill.opacity = Number(e.target.value)))}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        <p className="muted">{series.points.length} điểm dữ liệu{isStem ? " · đo từ pixel ảnh" : ""}</p>
        <div className="btn-row">
          {!isBar && !isStem && (
            <button className="btn sm" onClick={() => editSeries((s) => (s.points = densifyPoints(s.points, 1)))} title="Chèn thêm 1 điểm giữa mỗi cặp điểm, nằm đúng trên đường cong (điểm nội suy, không phải dữ liệu thật)">
              ×2 điểm
            </button>
          )}
          <button
            className="btn sm"
            onClick={() =>
              editPanel((p) => {
                const copy = structuredClone(series);
                copy.id = uid("s");
                copy.name = series.name + " (bản sao)";
                p.series.push(copy);
                onSelect({ kind: "series", panelId: p.id, seriesId: copy.id });
              })
            }
          >
            <Icon name="copy" size={14} /> Nhân đôi
          </button>
          <button className="btn sm icon" title="Vẽ phía sau" disabled={idx === 0} onClick={() => move(-1)}>
            <Icon name="down" size={14} />
          </button>
          <button className="btn sm icon" title="Vẽ phía trước" disabled={idx === panel.series.length - 1} onClick={() => move(1)}>
            <Icon name="up" size={14} />
          </button>
          <button
            className="btn sm danger"
            onClick={() => {
              editPanel((p) => (p.series = p.series.filter((x) => x.id !== series.id)));
              onSelect(null);
            }}
          >
            <Icon name="trash" size={14} /> Xoá series
          </button>
        </div>
      </Section>
    </>
  );
}

function PointSection({
  panel,
  series,
  index,
  update,
  onSelect,
}: {
  panel: Panel;
  series: Series;
  index: number;
  update: Update;
  onSelect: (s: Selection | null) => void;
}) {
  const pt = series.points[index];
  if (!pt) return null;
  const isBar = series.kind === "bar";
  const horizontal = (series.barOrientation ?? "vertical") === "horizontal";
  const n = series.points.length;
  const go = (i: number) => onSelect({ kind: "point", panelId: panel.id, seriesId: series.id, index: i });

  const editSeries = (mut: (s: Series) => void) =>
    update((d) => {
      const s = findPanel(d, panel.id)?.series.find((x) => x.id === series.id);
      if (s) mut(s);
    });
  const editPoint = (mut: (p: DataPoint) => void) => editSeries((s) => s.points[index] && mut(s.points[index]));

  // Bar ngang: giá trị ở x, category ở y. Bar dọc ngược lại. Line: x,y bình thường.
  const xLabel = isBar ? (horizontal ? "Giá trị (X)" : "Nhóm (X)") : "X";
  const yLabel = isBar ? (horizontal ? "Nhóm (Y)" : "Giá trị (Y)") : "Y";
  const stepX = axisStep(panel.xAxis);
  const stepY = axisStep(panel.yAxis);

  return (
    <Section
      title={`Điểm ${index + 1} / ${n}`}
      actions={
        <div className="pager">
          <button className="btn xs icon" disabled={index === 0} onClick={() => go(index - 1)} title="Điểm trước">
            <Icon name="left" size={14} />
          </button>
          <button className="btn xs icon" disabled={index === n - 1} onClick={() => go(index + 1)} title="Điểm sau">
            <Icon name="right" size={14} />
          </button>
        </div>
      }
    >
      <div className="grid2">
        <Field label={xLabel}>
          <NumInput value={pt.x} step={stepX} onChange={(v) => editPoint((p) => (p.x = v ?? 0))} />
        </Field>
        <Field label={yLabel}>
          <NumInput value={pt.y} step={stepY} onChange={(v) => editPoint((p) => (p.y = v ?? 0))} />
        </Field>
        <Field label={isBar ? "Sai số + (giá trị)" : "Sai số Y +"}>
          <NumInput value={pt.errorPlus} allowEmpty placeholder="—" step={stepY} onChange={(v) => editPoint((p) => (p.errorPlus = v))} />
        </Field>
        <Field label={isBar ? "Sai số −" : "Sai số Y −"}>
          <NumInput value={pt.errorMinus} allowEmpty placeholder="—" step={stepY} onChange={(v) => editPoint((p) => (p.errorMinus = v))} />
        </Field>
        {!isBar && series.kind !== "stem" && (
          <>
            <Field label="Sai số X +">
              <NumInput value={pt.xErrorPlus} allowEmpty placeholder="—" step={stepX} onChange={(v) => editPoint((p) => (p.xErrorPlus = v))} />
            </Field>
            <Field label="Sai số X −">
              <NumInput value={pt.xErrorMinus} allowEmpty placeholder="—" step={stepX} onChange={(v) => editPoint((p) => (p.xErrorMinus = v))} />
            </Field>
          </>
        )}
      </div>
      {(isBar || series.marker !== "none") && (
        <Check
          label={isBar ? "Thanh này tô đặc (bỏ = viền trắng)" : "Điểm này tô đặc (bỏ = viền trắng)"}
          checked={pt.filled ?? series.markerFilled}
          onChange={(v) => editPoint((p) => (p.filled = v))}
        />
      )}
      <div className="btn-row">
        <button
          className="btn sm"
          onClick={() => {
            editSeries((s) => s.points.splice(index + 1, 0, structuredClone(s.points[index])));
            go(index + 1);
          }}
        >
          <Icon name="plus" size={14} /> Thêm điểm sau
        </button>
        <button
          className="btn sm danger"
          onClick={() => {
            editSeries((s) => s.points.splice(index, 1));
            onSelect(n > 1 ? { kind: "point", panelId: panel.id, seriesId: series.id, index: Math.min(index, n - 2) } : { kind: "series", panelId: panel.id, seriesId: series.id });
          }}
        >
          <Icon name="trash" size={14} /> Xoá điểm
        </button>
      </div>
      <p className="muted">Mẹo: kéo điểm trên biểu đồ, hoặc dùng phím mũi tên để nhích.</p>
    </Section>
  );
}

// ---------------- Trục ----------------
function AxisInspector({ doc, sel, update }: { doc: ChartDocument; sel: Extract<Selection, { kind: "axis" }>; update: Update }) {
  const panel = findPanel(doc, sel.panelId);
  if (!panel) return <p className="insp-empty">Trục không còn tồn tại.</p>;
  const ax = sel.axis === "x" ? panel.xAxis : panel.yAxis;
  const edit = (mut: (a: Axis) => void) =>
    update((d) => {
      const p = findPanel(d, sel.panelId);
      if (p) mut(sel.axis === "x" ? p.xAxis : p.yAxis);
    });
  const category = ax.type === "category";
  return (
    <>
      <div className="insp-title">
        <Icon name="axis" />
        <span className="grow">Trục {sel.axis.toUpperCase()}</span>
        <span className="badge">{category ? "Phân loại" : "Số liên tục"}</span>
      </div>
      <Section title="Nhãn & thang đo">
        <Field label="Tên trục">
          <TextInput value={ax.label} placeholder="(không có)" onChange={(v) => edit((a) => (a.label = v))} />
        </Field>
        {!category && (
          <div className="grid2">
            <Field label="Nhỏ nhất">
              <NumInput value={ax.min} step={axisStep(ax)} onChange={(v) => edit((a) => (a.min = v ?? 0))} />
            </Field>
            <Field label="Lớn nhất">
              <NumInput value={ax.max} step={axisStep(ax)} onChange={(v) => edit((a) => (a.max = v ?? 0))} />
            </Field>
          </div>
        )}
        <Field label={category ? "Các nhóm" : "Vạch có số"} hint="Cách nhau bằng dấu phẩy; số thập phân dùng dấu chấm">
          <ListInput value={ax.ticks} onChange={(v) => edit((a) => (a.ticks = v))} />
        </Field>
        <div className="grid2">
          <Field label="Số lẻ thập phân">
            <NumInput value={ax.tickDecimals} allowEmpty placeholder="tự động" onChange={(v) => edit((a) => (a.tickDecimals = v === undefined ? undefined : Math.max(0, Math.min(6, Math.round(v)))))} />
          </Field>
          <Field label="Định dạng">
            <Segmented
              value={ax.tickFormat}
              options={[
                { value: "number", label: "Số" },
                { value: "percent", label: "%" },
              ]}
              onChange={(v) => edit((a) => (a.tickFormat = v))}
            />
          </Field>
        </div>
        <Check label="Hiện số trên trục" checked={ax.showTickLabels !== false} onChange={(v) => edit((a) => (a.showTickLabels = v ? undefined : false))} />
      </Section>
      <Section title="Cỡ chữ">
        <div className="grid2">
          <Field label="Số trên trục">
            <NumInput value={ax.fontSize ?? 12} step={1} onChange={(v) => edit((a) => (a.fontSize = Math.max(1, v ?? 12)))} />
          </Field>
          <Field label="Tên trục">
            <NumInput value={ax.labelFontSize ?? 13} step={1} onChange={(v) => edit((a) => (a.labelFontSize = Math.max(1, v ?? 13)))} />
          </Field>
        </div>
        <Field label="Khoảng cách trục → tên trục">
          <NumInput value={ax.labelOffset} allowEmpty placeholder="tự động" step={1} onChange={(v) => edit((a) => (a.labelOffset = v))} />
        </Field>
        <Check label="Tên trục in đậm" checked={ax.labelBold !== false} onChange={(v) => edit((a) => (a.labelBold = v ? undefined : false))} />
      </Section>
      <Section title="Kiểu trục">
        <div className="grid2">
          <Field label="Màu trục">
            <ColorInput value={ax.color ?? "#000000"} onChange={(v) => edit((a) => (a.color = v))} />
          </Field>
          <Field label="Đầu trục">
            <Segmented
              value={ax.axisStyle ?? "plain"}
              options={[
                { value: "plain", label: "Thẳng" },
                { value: "arrow", label: "Mũi tên" },
              ]}
              onChange={(v) => edit((a) => (a.axisStyle = v === "plain" ? undefined : v))}
            />
          </Field>
        </div>
      </Section>
      {!category && (
        <Section title="Lưới">
          <Field label="Vị trí đường lưới" hint="Để trống = không kẻ lưới">
            <ListInput value={ax.gridLines ?? []} placeholder="vd 20, 40, 60" onChange={(v) => edit((a) => (a.gridLines = v.length ? v : undefined))} />
          </Field>
          <GridGenerator axis={ax} onApply={(v) => edit((a) => (a.gridLines = v))} />
          {(ax.gridLines?.length ?? 0) > 0 && (
            <Field label="Màu lưới">
              <ColorInput value={ax.gridColor ?? "#DDDDDD"} onChange={(v) => edit((a) => (a.gridColor = v))} />
            </Field>
          )}
        </Section>
      )}
    </>
  );
}

// Tạo lưới cách đều nhanh: nhập bước, bấm "Tạo".
function GridGenerator({ axis, onApply }: { axis: Axis; onApply: (v: number[]) => void }) {
  const apply = (form: HTMLFormElement) => {
    const step = Number((new FormData(form).get("step") as string).replace(",", "."));
    if (!(step > 0) || (axis.max - axis.min) / step > 500) return;
    const out: number[] = [];
    for (let v = axis.min + step; v < axis.max - step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
    onApply(out);
  };
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <span>Kẻ đều mỗi</span>
      <input className="inp" name="step" inputMode="decimal" defaultValue={round(axisStep(axis) * 10)} />
      <button className="btn sm" type="submit">Tạo</button>
    </form>
  );
}

// ---------------- Chữ ----------------
function TextInspector({ doc, id, update, onSelect }: { doc: ChartDocument; id: string; update: Update; onSelect: (s: Selection | null) => void }) {
  const t = findText(doc, id);
  if (!t) return <p className="insp-empty">Chữ không còn tồn tại.</p>;
  const isFree = doc.freeTexts.some((x) => x.id === id);
  const edit = (mut: (t: TextSpec) => void) =>
    update((d) => {
      const x = findText(d, id);
      if (x) mut(x);
    });
  return (
    <>
      <div className="insp-title">
        <Icon name="text" />
        <span className="grow">{isFree ? "Chữ tự do" : "Tiêu đề biểu đồ"}</span>
      </div>
      <Section title="Nội dung">
        <textarea className="inp" rows={2} value={t.content} onChange={(e) => edit((x) => (x.content = e.target.value))} />
      </Section>
      <Section title="Kiểu chữ">
        <div className="grid2">
          <Field label="Cỡ chữ">
            <NumInput value={t.fontSize} step={1} onChange={(v) => edit((x) => (x.fontSize = Math.max(1, v ?? 12)))} />
          </Field>
          <Field label="Màu">
            <ColorInput value={t.color} onChange={(v) => edit((x) => (x.color = v))} />
          </Field>
        </div>
        <Field label="Font">
          <SelectInput
            value={t.fontFamily}
            options={[...new Set([t.fontFamily, ...FONTS])].map((f) => ({ value: f, label: f }))}
            onChange={(v) => edit((x) => (x.fontFamily = v))}
          />
        </Field>
        <div className="grid2">
          <Check label="Đậm" checked={t.fontWeight === "bold"} onChange={(v) => edit((x) => (x.fontWeight = v ? "bold" : "normal"))} />
          <Check label="Nghiêng" checked={t.fontStyle === "italic"} onChange={(v) => edit((x) => (x.fontStyle = v ? "italic" : "normal"))} />
        </div>
      </Section>
      <Section title="Vị trí">
        <Field label="Neo chữ">
          <Segmented
            value={t.anchor}
            options={[
              { value: "start", label: "Trái" },
              { value: "middle", label: "Giữa" },
              { value: "end", label: "Phải" },
            ]}
            onChange={(v) => edit((x) => (x.anchor = v))}
          />
        </Field>
        <div className="grid3">
          <Field label="X">
            <NumInput value={round(t.x)} onChange={(v) => edit((x) => (x.x = v ?? 0))} />
          </Field>
          <Field label="Y">
            <NumInput value={round(t.y)} onChange={(v) => edit((x) => (x.y = v ?? 0))} />
          </Field>
          <Field label="Xoay (°)">
            <NumInput value={t.rotation} step={15} onChange={(v) => edit((x) => (x.rotation = v ?? 0))} />
          </Field>
        </div>
        <p className="muted">Kéo chữ trên biểu đồ để di chuyển.</p>
      </Section>
      {isFree && (
        <div className="btn-row pad">
          <button
            className="btn sm danger"
            onClick={() => {
              update((d) => (d.freeTexts = d.freeTexts.filter((x) => x.id !== id)));
              onSelect(null);
            }}
          >
            <Icon name="trash" size={14} /> Xoá chữ
          </button>
        </div>
      )}
    </>
  );
}

// Bước nhích hợp lý theo độ dài trục (~1/100), làm tròn về 1/2/5×10^n.
function axisStep(ax: Axis): number {
  if (ax.type === "category") return 1;
  const raw = Math.abs(ax.max - ax.min) / 100 || 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 2 ? 1 : m < 5 ? 2 : 5) * p;
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
