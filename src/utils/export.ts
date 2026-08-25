import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";

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
