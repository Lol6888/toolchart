import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartDocument } from "./types/chart";
import { analyzeChart, normalizeDoc } from "./services/gemini";
import { traceStemsFromImage } from "./services/pixelTrace";
import { ChartSvg } from "./render/ChartSvg";
import { type Selection, findPanel, walkPanels } from "./editor/util";
import { useHistory } from "./editor/history";
import { exportSvg, exportPdf, exportPng, saveProject, parseProject, fileToDataUrl } from "./utils/export";
import { SAMPLE_DOC, SAMPLE_BAR_DOC, SAMPLE_CHROMA_DOC, SAMPLE_DECONV_DOC, SAMPLE_HIST_DOC } from "./sample/example";
import { Topbar, type ExportKind } from "./components/Topbar";
import { StartScreen, type AnalyzeState } from "./components/StartScreen";
import { SettingsDialog } from "./components/SettingsDialog";
import { Canvas, type CompareMode } from "./components/Canvas";
import { LayersPanel } from "./components/LayersPanel";
import { Inspector, findText, kindLabel } from "./components/Inspector";

const LS_KEY = "toolchart_api_key";
const LS_MODEL = "toolchart_model";
const LS_AUTOSAVE = "toolchart_autosave";

const SAMPLES: { id: string; label: string; desc: string; doc: ChartDocument }[] = [
  { id: "line", label: "Đường + sai số", desc: "2 panel, inset, error bar 2 chiều", doc: SAMPLE_DOC },
  { id: "bar", label: "Thanh nhóm", desc: "Thanh ngang, có sai số", doc: SAMPLE_BAR_DOC },
  { id: "chroma", label: "Chromatogram", desc: "Vùng pha, vùng tô dưới đường", doc: SAMPLE_CHROMA_DOC },
  { id: "deconv", label: "Deconvolution", desc: "Đường bao + chấm thành phần", doc: SAMPLE_DECONV_DOC },
  { id: "hist", label: "Histogram", desc: "Hàng trăm vạch + đường fit", doc: SAMPLE_HIST_DOC },
];

// localStorage có thể bị chặn (chế độ riêng tư) — không để vì thế mà app hỏng.
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* hết chỗ / bị chặn: bỏ qua */
  }
};
function readAutosave(): { name: string; savedAt: number; doc: ChartDocument } | null {
  try {
    const raw = lsGet(LS_AUTOSAVE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const baseName = (n: string) => n.replace(/\.[^.]+$/, "") || "chart";
const safeFile = (n: string) => n.trim().replace(/[\\/:*?"<>|]+/g, "_") || "chart";

export default function App() {
  const [apiKey, setApiKey] = useState(() => lsGet(LS_KEY) ?? "");
  const [model, setModel] = useState(() => lsGet(LS_MODEL) ?? "gemini-3.1-pro-preview");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hist = useHistory<ChartDocument | null>(null);
  const doc = hist.present;
  const [selected, setSelected] = useState<Selection | null>(null);
  const [name, setName] = useState("chart");

  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<AnalyzeState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const [compare, setCompare] = useState<CompareMode>("off");
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [restore, setRestore] = useState(() => {
    const a = readAutosave();
    return a ? { name: a.name, savedAt: a.savedAt } : null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const exportRef = useRef<SVGSVGElement>(null);
  const openRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2500);
  }, []);

  // ---- tự lưu document (không lưu ảnh: dễ vượt giới hạn localStorage) ----
  useEffect(() => {
    if (!doc) return;
    const t = window.setTimeout(() => {
      const savedAt = Date.now();
      lsSet(LS_AUTOSAVE, JSON.stringify({ name, savedAt, doc }));
      setRestore({ name, savedAt });
    }, 600);
    return () => window.clearTimeout(t);
  }, [doc, name]);

  useEffect(() => {
    if (!analyzing) return;
    setElapsed(0);
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - analyzing.startedAt) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [analyzing?.startedAt]);

  const setImage = (f: File | null, url: string | null) => {
    setImgUrl((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return url;
    });
    setFile(f);
  };

  const onFile = (f: File) => {
    setError(null);
    setImage(f, URL.createObjectURL(f));
    setName(baseName(f.name));
  };

  const loadDoc = (d: ChartDocument, docName: string) => {
    hist.reset(d);
    setSelected(null);
    setZoom("fit");
    setName(docName);
  };

  const runAnalyze = async () => {
    if (!file || !apiKey) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setAnalyzing({ startedAt: Date.now(), stage: "AI đang đọc biểu đồ…" });
    try {
      const result = await analyzeChart(file, { apiKey, model }, ctrl.signal);
      setAnalyzing((a) => a && { ...a, stage: "Đang đo lại chi tiết từ pixel ảnh…" });
      // histogram dày (series 'stem'): đọc lại chiều cao từng cột từ pixel ảnh gốc
      const traced = await traceStemsFromImage(result, file);
      loadDoc(traced, baseName(file.name));
      setCompare("off");
    } catch (e: any) {
      if (e?.name !== "AbortError") setError({ message: e?.message ?? String(e), detail: e?.detail });
    } finally {
      abortRef.current = null;
      setAnalyzing(null);
    }
  };

  // Dán ảnh (Ctrl+V) ở màn hình bắt đầu.
  useEffect(() => {
    if (doc) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) onFile(new File([f], f.name || "anh-dan.png", { type: f.type }));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [doc]);

  // ---- dự án ----
  const onSaveProject = async () => {
    if (!doc) return;
    const image = file ? await fileToDataUrl(file) : imgUrl?.startsWith("data:") ? imgUrl : undefined;
    saveProject({ name: safeFile(name), doc, image });
    notify("Đã lưu dự án");
  };
  const onOpenProjectFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const p = parseProject(await f.text());
      loadDoc(normalizeDoc(p.doc), p.name);
      setImage(null, p.image ?? null);
      setCompare("off");
    } catch (e: any) {
      notify(e?.message?.startsWith("File") ? e.message : "Không đọc được file dự án.");
    }
  };

  const onExport = async (k: ExportKind) => {
    if (k === "project") return onSaveProject();
    const svg = exportRef.current; // bản render sạch: không vùng bắt click, không highlight chọn
    if (!svg) return;
    const fn = safeFile(name);
    try {
      if (k === "svg") exportSvg(svg, `${fn}.svg`);
      else if (k === "pdf") await exportPdf(svg, `${fn}.pdf`);
      else await exportPng(svg, `${fn}.png`);
      notify(`Đã xuất ${fn}.${k}`);
    } catch {
      notify("Xuất file thất bại.");
    }
  };

  // ---- phím tắt ----
  const deleteSelected = () => {
    if (!doc || !selected) return;
    const next = structuredClone(doc);
    if (selected.kind === "point") {
      const s = findPanel(next, selected.panelId)?.series.find((x) => x.id === selected.seriesId);
      if (!s) return;
      s.points.splice(selected.index, 1);
      setSelected(s.points.length ? { ...selected, index: Math.min(selected.index, s.points.length - 1) } : null);
    } else if (selected.kind === "series") {
      const p = findPanel(next, selected.panelId);
      if (!p) return;
      p.series = p.series.filter((x) => x.id !== selected.seriesId);
      setSelected(null);
    } else if (selected.kind === "text") {
      if (!next.freeTexts.some((t) => t.id === selected.id)) return; // tiêu đề panel: không xoá bằng phím
      next.freeTexts = next.freeTexts.filter((t) => t.id !== selected.id);
      setSelected(null);
    } else return;
    hist.set(next);
  };

  const nudge = (key: string, big: boolean) => {
    if (!doc || selected?.kind !== "point") return;
    const next = structuredClone(doc);
    const p = findPanel(next, selected.panelId);
    const pt = p?.series.find((x) => x.id === selected.seriesId)?.points[selected.index];
    if (!p || !pt) return;
    const k = big ? 10 : 1;
    const dy = ((p.yAxis.max - p.yAxis.min) / 500) * k;
    const dx = ((p.xAxis.max - p.xAxis.min) / 500) * k;
    const r = (v: number) => Math.round(v * 1e4) / 1e4;
    if (key === "ArrowUp" && p.yAxis.type !== "category") pt.y = r(pt.y + dy);
    else if (key === "ArrowDown" && p.yAxis.type !== "category") pt.y = r(pt.y - dy);
    else if (key === "ArrowRight" && p.xAxis.type !== "category") pt.x = r(pt.x + dx);
    else if (key === "ArrowLeft" && p.xAxis.type !== "category") pt.x = r(pt.x - dx);
    else return;
    hist.set(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        onSaveProject();
        return;
      }
      if ((e.target as HTMLElement).closest("input, textarea, select")) {
        // đang gõ: để ô nhập tự xử lý; Esc thì thoát ô để phím tắt canvas dùng được ngay
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        e.shiftKey ? hist.redo() : hist.undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        hist.redo();
      } else if (e.key === "Escape") setSelected(null);
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key.startsWith("Arrow") && selected?.kind === "point") {
        e.preventDefault();
        nudge(e.key, e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const zoomBy = useCallback(
    (f: number) => setZoom((z) => Math.min(8, Math.max(0.05, (z === "fit" ? fitZoom : z) * f))),
    [fitZoom]
  );

  const backToStart = () => {
    hist.reset(null);
    setSelected(null);
    setError(null);
  };

  return (
    <div className="app">
      <Topbar
        hasKey={!!apiKey}
        onSettings={() => setSettingsOpen(true)}
        editor={
          doc
            ? {
                name,
                onRename: setName,
                canUndo: hist.canUndo,
                canRedo: hist.canRedo,
                onUndo: hist.undo,
                onRedo: hist.redo,
                zoomPct: Math.round((zoom === "fit" ? fitZoom : zoom) * 100),
                onZoomBy: zoomBy,
                onZoomFit: () => setZoom("fit"),
                onZoomReset: () => setZoom(1),
                hasImage: !!imgUrl,
                compare,
                onCompare: setCompare,
                overlayOpacity,
                onOverlayOpacity: setOverlayOpacity,
                backLabel: file ? "Phân tích lại" : "Ảnh mới",
                onBack: backToStart,
                onExport,
              }
            : null
        }
      />

      {doc ? (
        <div className="workspace">
          <aside className="side left">
            <LayersPanel doc={doc} selected={selected} onChange={hist.set} onSelect={setSelected} />
          </aside>
          <main className="center">
            <Canvas
              doc={doc}
              imgUrl={imgUrl}
              zoom={zoom}
              compare={compare}
              overlayOpacity={overlayOpacity}
              selected={selected}
              onChange={hist.set}
              onSelect={setSelected}
              onFitZoom={setFitZoom}
              onZoomBy={zoomBy}
            />
            <footer className="statusbar">
              <span className="ellipsis">{describe(doc, selected)}</span>
              <span className="grow" />
              <span className="muted hide-sm">Ctrl+Z hoàn tác · Del xoá · ←↑→↓ nhích · Esc bỏ chọn</span>
            </footer>
          </main>
          <aside className="side right">
            <Inspector doc={doc} selected={selected} onChange={hist.set} onSelect={setSelected} />
          </aside>
          {/* Bản render tĩnh dùng để xuất file */}
          <div className="export-host" aria-hidden="true">
            <ChartSvg doc={doc} svgRef={exportRef} />
          </div>
        </div>
      ) : (
        <StartScreen
          file={file}
          imgUrl={imgUrl}
          apiKey={apiKey}
          analyzing={analyzing}
          elapsed={elapsed}
          error={error}
          samples={SAMPLES}
          restore={restore}
          onFile={onFile}
          onClearFile={() => {
            setImage(null, null);
            setError(null);
          }}
          onAnalyze={runAnalyze}
          onCancel={() => abortRef.current?.abort()}
          onSaveKey={(k) => {
            setApiKey(k);
            lsSet(LS_KEY, k);
          }}
          onSample={(id) => {
            const s = SAMPLES.find((x) => x.id === id)!;
            setImage(null, null);
            loadDoc(structuredClone(s.doc), `mau-${s.id}`);
          }}
          onRestore={() => {
            const a = readAutosave();
            try {
              if (a) loadDoc(normalizeDoc(a.doc), a.name);
            } catch {
              notify("Bản tự lưu bị hỏng, không mở được.");
            }
          }}
          onOpenProject={() => openRef.current?.click()}
        />
      )}

      <input
        ref={openRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          onOpenProjectFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {settingsOpen && (
        <SettingsDialog
          apiKey={apiKey}
          model={model}
          onClose={() => setSettingsOpen(false)}
          onSave={(k, m) => {
            setApiKey(k);
            setModel(m);
            lsSet(LS_KEY, k);
            lsSet(LS_MODEL, m);
            setSettingsOpen(false);
            notify("Đã lưu cài đặt");
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// Mô tả thứ đang chọn cho thanh trạng thái.
function describe(doc: ChartDocument, sel: Selection | null): string {
  if (!sel) return `${walkPanels(doc).length} biểu đồ · bấm vào phần tử để chỉnh`;
  if (sel.kind === "text") return `Chữ: “${findText(doc, sel.id)?.content ?? ""}”`;
  const p = findPanel(doc, sel.panelId);
  if (sel.kind === "axis") return `Trục ${sel.axis.toUpperCase()}${p ? " · " + (sel.axis === "x" ? p.xAxis : p.yAxis).label : ""}`;
  const s = p?.series.find((x) => x.id === sel.seriesId);
  if (!s) return "";
  if (sel.kind === "series") return `${kindLabel(s)} “${s.name}” · ${s.points.length} điểm`;
  const pt = s.points[sel.index];
  return `${s.name} · điểm ${sel.index + 1}/${s.points.length}${pt ? ` · x = ${pt.x}, y = ${pt.y}` : ""}`;
}
