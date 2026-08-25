import { EXTRACTION_PROMPT } from "./prompt";
import type { ChartDocument } from "../types/chart";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiConfig {
  apiKey: string;
  model: string; // vd "gemini-3.1-pro-preview"
}

// Chuyển File ảnh -> base64 (bỏ tiền tố data:...;base64,)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Phóng ảnh sao cho cạnh dài >= minLongSide (mặc định 2048) trước khi gửi Gemini,
// giúp model thấy rõ chi tiết (chữ nhỏ, chấm, error bar) hơn với ảnh gốc nhỏ.
// LƯU Ý: đây là nội suy canvas, KHÔNG tạo chi tiết mới — chỉ hữu ích khi ảnh gốc nhỏ.
// Ảnh đã lớn hơn ngưỡng thì giữ nguyên. Trả về base64 PNG + mimeType.
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function preprocessImage(
  file: File,
  minLongSide = 2048
): Promise<{ base64: string; mimeType: string }> {
  const img = await loadImage(file);
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long >= minLongSide || long === 0) {
    return { base64: await fileToBase64(file), mimeType: file.type || "image/png" };
  }
  const scale = minLongSide / long;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  return { base64: dataUrl.split(",")[1], mimeType: "image/png" };
}

// Lấy JSON ra khỏi text kể cả khi model bọc trong ```json ... ```
function parseJsonLoose(text: string): ChartDocument {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
  }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1) t = t.slice(first, last + 1);
  return JSON.parse(t) as ChartDocument;
}

export async function analyzeChart(
  file: File,
  cfg: GeminiConfig
): Promise<ChartDocument> {
  const { base64, mimeType } = await preprocessImage(file);
  const url = `${ENDPOINT}/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API lỗi ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
    undefined;

  if (!text) {
    throw new Error("Gemini không trả về nội dung. Phản hồi: " + JSON.stringify(data).slice(0, 500));
  }

  try {
    return parseJsonLoose(text);
  } catch (e) {
    throw new Error("Không parse được JSON từ Gemini:\n" + text.slice(0, 1000));
  }
}
