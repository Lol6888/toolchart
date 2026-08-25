import { useRef, useState } from "react";
import type { ChartDocument } from "./types/chart";
import { analyzeChart } from "./services/gemini";
import { ChartSvg } from "./render/ChartSvg";
import { EditPanel } from "./components/EditPanel";
import { SelectionPanel } from "./components/SelectionPanel";
import type { Selection } from "./editor/util";
import { exportSvg, exportPdf } from "./utils/export";
import { SAMPLE_DOC, SAMPLE_BAR_DOC } from "./sample/example";

const LS_KEY = "toolchart_api_key";
const LS_MODEL = "toolchart_model";

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) ?? "");
  const [model, setModel] = useState(
    () => localStorage.getItem(LS_MODEL) ?? "gemini-3.1-pro-preview"
  );
  const [doc, setDoc] = useState<ChartDocument | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const persistKey = (v: string) => {
    setApiKey(v);
    localStorage.setItem(LS_KEY, v);
  };
  const persistModel = (v: string) => {
    setModel(v);
    localStorage.setItem(LS_MODEL, v);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setImgUrl(URL.createObjectURL(file));
    if (!apiKey) {
      setError("Chưa nhập API key. Ảnh đã tải lên, bấm 'Phân tích' sau khi nhập key.");
      (window as any).__pendingFile = file;
      return;
    }
    await runAnalyze(file);
  };

  const runAnalyze = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeChart(file, { apiKey, model });
      setDoc(result);
      setSelected(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>ToolChart</h1>
        <span className="tag">Ảnh biểu đồ → Vector chỉnh sửa được → SVG / PDF</span>
      </header>

      <div className="config-bar">
        <label className="field grow">
          <span>Gemini API Key</span>
          <input
            type="password"
            placeholder="Dán API key của bạn"
            value={apiKey}
            onChange={(e) => persistKey(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input value={model} onChange={(e) => persistModel(e.target.value)} />
        </label>
        <label className="field file-field">
          <span>Ảnh input</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <button
          className="btn"
          disabled={loading}
          onClick={() => {
            const pending = (window as any).__pendingFile as File | undefined;
            if (pending) runAnalyze(pending);
          }}
        >
          {loading ? "Đang phân tích…" : "Phân tích"}
        </button>
        <button className="btn ghost" onClick={() => { setDoc(SAMPLE_DOC); setSelected(null); }}>
          Mẫu line
        </button>
        <button className="btn ghost" onClick={() => { setDoc(SAMPLE_BAR_DOC); setSelected(null); }}>
          Mẫu bar
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="workspace">
        <aside className="left-col">
          {imgUrl && (
            <div className="orig">
              <h3>Ảnh gốc</h3>
              <img src={imgUrl} alt="input" />
            </div>
          )}
          {doc && (
            <SelectionPanel doc={doc} selected={selected} onChange={setDoc} onSelect={setSelected} />
          )}
          {doc && <EditPanel doc={doc} onChange={setDoc} />}
        </aside>

        <main className="canvas-col">
          {doc ? (
            <>
              <div className="canvas-toolbar">
                <button className="btn" onClick={() => svgRef.current && exportSvg(svgRef.current)}>
                  Xuất SVG
                </button>
                <button className="btn" onClick={() => svgRef.current && exportPdf(svgRef.current)}>
                  Xuất PDF
                </button>
              </div>
              <div className="canvas-scroll">
                <ChartSvg
                  doc={doc}
                  svgRef={svgRef}
                  onChange={setDoc}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </>
          ) : (
            <div className="empty">
              <p>Tải ảnh biểu đồ (PNG/JPG) lên và bấm <b>Phân tích</b>, hoặc bấm <b>Dùng mẫu</b> để xem thử.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
