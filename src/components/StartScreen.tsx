// Màn hình khi chưa có biểu đồ: kéo-thả/dán ảnh → xem lại ảnh → bấm Phân tích.
// Không tự gọi AI ngay khi chọn ảnh (tốn quota, người dùng chưa kịp kiểm tra ảnh).
import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { KeyPrivacyNote, KEY_HELP_URL } from "./SettingsDialog";

export interface SampleItem {
  id: string;
  label: string;
  desc: string;
}

export interface AnalyzeState {
  startedAt: number;
  stage: string;
}

export function StartScreen({
  file,
  imgUrl,
  apiKey,
  analyzing,
  elapsed,
  error,
  samples,
  restore,
  onFile,
  onClearFile,
  onAnalyze,
  onCancel,
  onSaveKey,
  onSample,
  onRestore,
  onOpenProject,
}: {
  file: File | null;
  imgUrl: string | null;
  apiKey: string;
  analyzing: AnalyzeState | null;
  elapsed: number;
  error: { message: string; detail?: string } | null;
  samples: SampleItem[];
  restore: { name: string; savedAt: number } | null;
  onFile: (f: File) => void;
  onClearFile: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onSaveKey: (k: string) => void;
  onSample: (id: string) => void;
  onRestore: () => void;
  onOpenProject: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <div className="start">
      <div className="start-inner">
        {!file ? (
          <>
            <div className="hero">
              <h2>Biến ảnh biểu đồ thành vector chỉnh sửa được</h2>
              <ol className="steps">
                <li><b>1</b> Tải ảnh biểu đồ lên</li>
                <li><b>2</b> AI dựng lại thành vector</li>
                <li><b>3</b> Chỉnh rồi xuất SVG / PDF / PNG</li>
              </ol>
            </div>
            <button
              type="button"
              className={"dropzone" + (drag ? " drag" : "")}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files);
              }}
            >
              <Icon name="upload" size={32} />
              <span className="dz-main">Kéo thả ảnh vào đây, hoặc bấm để chọn</span>
              <span className="dz-sub">PNG, JPG, WEBP · có thể dán ảnh bằng Ctrl+V</span>
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files)} />
          </>
        ) : (
          <div className="review">
            <div className="review-img">
              <img src={imgUrl ?? undefined} alt="Ảnh biểu đồ đã chọn" />
            </div>
            <div className="review-side">
              <div className="file-chip">
                <Icon name="image" />
                <span className="grow ellipsis" title={file.name}>{file.name}</span>
                <span className="muted">{Math.round(file.size / 1024)} KB</span>
              </div>

              {analyzing ? (
                <div className="progress">
                  <div className="spinner" aria-hidden="true" />
                  <div>
                    <div className="progress-stage">{analyzing.stage}</div>
                    <div className="muted">{elapsed}s · thường mất 20–90 giây</div>
                  </div>
                  <button className="btn ghost sm" onClick={onCancel}>Huỷ</button>
                </div>
              ) : !apiKey ? (
                <form
                  className="key-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (keyDraft.trim()) onSaveKey(keyDraft.trim());
                  }}
                >
                  <div className="key-card-head">
                    <Icon name="key" /> <b>Cần Gemini API key để phân tích</b>
                  </div>
                  <div className="inp-group">
                    <input className="inp" type="password" placeholder="Dán API key (AIza…)" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
                    <button className="btn primary" type="submit" disabled={!keyDraft.trim()}>Lưu</button>
                  </div>
                  <p className="muted">
                    <a href={KEY_HELP_URL} target="_blank" rel="noreferrer">Lấy key miễn phí tại Google AI Studio</a>
                  </p>
                  <KeyPrivacyNote />
                </form>
              ) : (
                <button className="btn primary lg" onClick={onAnalyze}>
                  <Icon name="sparkle" /> {error ? "Phân tích lại" : "Phân tích bằng AI"}
                </button>
              )}

              {error && !analyzing && (
                <div className="alert">
                  <b>Không phân tích được.</b> {error.message}
                  {error.detail && (
                    <details>
                      <summary>Chi tiết kỹ thuật</summary>
                      <pre>{error.detail}</pre>
                    </details>
                  )}
                </div>
              )}

              {!analyzing && (
                <button className="btn ghost" onClick={onClearFile}>
                  Chọn ảnh khác
                </button>
              )}
              <p className="muted">Mẹo: cắt sát vùng biểu đồ trước khi tải lên giúp AI đọc chính xác hơn.</p>
            </div>
          </div>
        )}

        {!file && (
          <div className="start-more">
            {restore && (
              <button className="card-btn accent" onClick={onRestore}>
                <Icon name="refresh" />
                <span>
                  <b>Tiếp tục phiên trước</b>
                  <span className="muted">
                    {restore.name} · {new Date(restore.savedAt).toLocaleString("vi-VN")}
                  </span>
                </span>
              </button>
            )}
            <button className="card-btn" onClick={onOpenProject}>
              <Icon name="folder" />
              <span>
                <b>Mở dự án đã lưu</b>
                <span className="muted">File .toolchart.json</span>
              </span>
            </button>
            <div className="samples">
              <h4>Hoặc xem thử với biểu đồ mẫu (không cần key)</h4>
              <div className="sample-grid">
                {samples.map((s) => (
                  <button key={s.id} className="sample" onClick={() => onSample(s.id)}>
                    <b>{s.label}</b>
                    <span className="muted">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
