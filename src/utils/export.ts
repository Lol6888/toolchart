import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { ChartDocument } from "../types/chart";

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSvg(svg: SVGSVGElement, filename = "chart.svg") {
  const str = serializeSvg(svg);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

// PNG: vẽ SVG lên canvas. Ảnh nhỏ thì nhân 2 cho nét khi in/chèn slide.
export async function exportPng(svg: SVGSVGElement, filename = "chart.png") {
  const w = Number(svg.getAttribute("width")) || svg.clientWidth;
  const h = Number(svg.getAttribute("height")) || svg.clientHeight;
  const scale = w < 1500 ? 2 : 1;
  const url = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (blob) triggerDownload(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Dự án = document + ảnh gốc (data URL, để mở lại vẫn so sánh được). Không chứa API key.
export interface ProjectFile {
  app: "toolchart";
  version: 1;
  name: string;
  doc: ChartDocument;
  image?: string;
}

export function saveProject(p: Omit<ProjectFile, "app" | "version">) {
  const data: ProjectFile = { app: "toolchart", version: 1, ...p };
  triggerDownload(new Blob([JSON.stringify(data)], { type: "application/json" }), `${p.name}.toolchart.json`);
}

export function parseProject(text: string): ProjectFile {
  const data = JSON.parse(text);
  if (data?.app !== "toolchart" || !data.doc?.panels) throw new Error("File không phải dự án ToolChart.");
  return data as ProjectFile;
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function exportPdf(svg: SVGSVGElement, filename = "chart.pdf") {
  const w = Number(svg.getAttribute("width")) || svg.clientWidth;
  const h = Number(svg.getAttribute("height")) || svg.clientHeight;
  const pdf = new jsPDF({
    orientation: w >= h ? "landscape" : "portrait",
    unit: "pt",
    format: [w, h],
  });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: w, height: h });
  pdf.save(filename);
}
