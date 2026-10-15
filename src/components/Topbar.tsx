import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Segmented } from "./ui";
import type { CompareMode } from "./Canvas";

export type ExportKind = "svg" | "pdf" | "png" | "project";

export interface EditorBarProps {
  name: string;
  onRename: (v: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoomPct: number;
  onZoomBy: (f: number) => void;
  onZoomFit: () => void;
  onZoomReset: () => void;
  hasImage: boolean;
  compare: CompareMode;
  onCompare: (m: CompareMode) => void;
  overlayOpacity: number;
  onOverlayOpacity: (v: number) => void;
  backLabel: string;
  onBack: () => void;
  onExport: (k: ExportKind) => void;
}

export function Topbar({ editor, onSettings, hasKey }: { editor: EditorBarProps | null; onSettings: () => void; hasKey: boolean }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <Icon name="series" size={16} />
        </span>
        <span className="brand-name">ToolChart</span>
      </div>
      {editor && (
        <>
          <input className="doc-name" value={editor.name} onChange={(e) => editor.onRename(e.target.value)} aria-label="Tên file khi xuất" title="Tên file khi xuất" />
          <div className="tb-group">
            <button className="btn ghost icon" onClick={editor.onUndo} disabled={!editor.canUndo} title="Hoàn tác (Ctrl+Z)">
              <Icon name="undo" />
            </button>
            <button className="btn ghost icon" onClick={editor.onRedo} disabled={!editor.canRedo} title="Làm lại (Ctrl+Shift+Z)">
              <Icon name="redo" />
            </button>
          </div>
          <div className="tb-group">
            <button className="btn ghost icon" onClick={() => editor.onZoomBy(1 / 1.25)} title="Thu nhỏ (Ctrl + lăn chuột)">
              <Icon name="minus" />
            </button>
            <button className="btn ghost zoom-pct" onClick={editor.onZoomReset} title="Về 100%">
              {editor.zoomPct}%
            </button>
            <button className="btn ghost icon" onClick={() => editor.onZoomBy(1.25)} title="Phóng to (Ctrl + lăn chuột)">
              <Icon name="plus" />
            </button>
            <button className="btn ghost icon" onClick={editor.onZoomFit} title="Vừa khung">
              <Icon name="fit" />
            </button>
          </div>
          <div className="tb-group" title={editor.hasImage ? "So sánh với ảnh gốc" : "Không có ảnh gốc để so sánh (biểu đồ mẫu)"}>
            <Icon name="compare" />
            <div className={editor.hasImage ? "" : "disabled"}>
              <Segmented
                value={editor.hasImage ? editor.compare : "off"}
                options={[
                  { value: "off", label: "Tắt" },
                  { value: "side", label: "Song song" },
                  { value: "overlay", label: "Chồng lớp", title: "Phủ ảnh gốc mờ lên vector để thấy chỗ lệch" },
                ]}
                onChange={(v) => editor.hasImage && editor.onCompare(v)}
              />
            </div>
            {editor.hasImage && editor.compare === "overlay" && (
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={editor.overlayOpacity}
                onChange={(e) => editor.onOverlayOpacity(Number(e.target.value))}
                title="Độ mờ ảnh gốc"
                className="opacity"
              />
            )}
          </div>
          <div className="grow" />
          <button className="btn ghost" onClick={editor.onBack}>
            <Icon name="image" /> {editor.backLabel}
          </button>
          <ExportMenu onExport={editor.onExport} />
        </>
      )}
      {!editor && <div className="grow" />}
      <button className={"btn ghost" + (hasKey ? " icon" : "")} onClick={onSettings} title="Cài đặt API key & model">
        <Icon name="settings" />
        {!hasKey && <span>Nhập API key</span>}
      </button>
    </header>
  );
}

function ExportMenu({ onExport }: { onExport: (k: ExportKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const item = (k: ExportKind, label: string, desc: string) => (
    <button
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onExport(k);
      }}
    >
      <b>{label}</b>
      <span className="muted">{desc}</span>
    </button>
  );
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn primary" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="download" /> Xuất <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {item("svg", "SVG", "Vector, mở bằng Illustrator / Inkscape / Figma")}
          {item("pdf", "PDF", "Vector, chèn vào bài báo / tài liệu")}
          {item("png", "PNG", "Ảnh độ phân giải cao cho slide, web")}
          <hr />
          {item("project", "Lưu dự án (.json)", "Mở lại để sửa tiếp · Ctrl+S")}
        </div>
      )}
    </div>
  );
}
