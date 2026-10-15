// Vùng canvas: zoom (vừa khung / %), so sánh với ảnh gốc (song song hoặc chồng lớp).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChartDocument } from "../types/chart";
import type { Selection } from "../editor/util";
import { ChartSvg } from "../render/ChartSvg";

export type CompareMode = "off" | "side" | "overlay";

export function Canvas({
  doc,
  imgUrl,
  zoom,
  compare,
  overlayOpacity,
  selected,
  onChange,
  onSelect,
  onFitZoom,
  onZoomBy,
}: {
  doc: ChartDocument;
  imgUrl: string | null;
  zoom: number | "fit";
  compare: CompareMode;
  overlayOpacity: number;
  selected: Selection | null;
  onChange: (d: ChartDocument) => void;
  onSelect: (s: Selection | null) => void;
  onFitZoom: (z: number) => void; // báo tỉ lệ "vừa khung" thực tế để topbar hiện %
  onZoomBy: (factor: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const side = compare === "side" && !!imgUrl;
  const pad = 48;
  const availW = side ? (box.w - pad * 1.5) / 2 : box.w - pad;
  const fit = Math.max(0.05, Math.min(availW / doc.width, (box.h - pad) / doc.height));
  const z = zoom === "fit" ? fit : zoom;
  useEffect(() => {
    if (zoom === "fit") onFitZoom(fit);
  }, [zoom, fit, onFitZoom]);

  // Ctrl/Cmd + lăn chuột để zoom (listener không passive để chặn zoom trang).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [onZoomBy]);

  const w = doc.width * z;
  const h = doc.height * z;

  return (
    <div className="canvas-wrap" ref={wrapRef} onPointerDown={(e) => e.target === e.currentTarget && onSelect(null)}>
      <div className={"canvas-row" + (side ? " side" : "")}>
        <div className="stage" style={{ width: w, height: h }}>
          {side && <span className="stage-tag">Vector</span>}
          <ChartSvg doc={doc} onChange={onChange} selected={selected} onSelect={onSelect} />
          {compare === "overlay" && imgUrl && (
            // Ảnh gốc phủ lên trên, xuyên click: thấy ngay chỗ lệch mà vẫn kéo-sửa được.
            <img className="overlay-img" src={imgUrl} alt="" style={{ opacity: overlayOpacity }} />
          )}
        </div>
        {side && (
          <div className="stage" style={{ width: w, height: h }}>
            <span className="stage-tag">Ảnh gốc</span>
            <img className="orig-img" src={imgUrl!} alt="Ảnh gốc" />
          </div>
        )}
      </div>
    </div>
  );
}
