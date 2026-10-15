import { EXTRACTION_PROMPT } from "./prompt";
import type { ChartDocument, Panel } from "../types/chart";

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
export function loadImage(file: File): Promise<HTMLImageElement> {
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

// Lỗi đã dịch sang lời dễ hiểu; `detail` giữ phản hồi gốc để người dùng mở xem khi cần.
export class AnalyzeError extends Error {
  constructor(message: string, public detail?: string) {
    super(message);
  }
}

function friendlyHttpError(status: number, body: string, model: string): AnalyzeError {
  let msg: string;
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) msg = "API key không hợp lệ. Kiểm tra lại key trong Cài đặt.";
  else if (status === 400) msg = "Gemini từ chối yêu cầu (400). Thử ảnh khác hoặc model khác.";
  else if (status === 401 || status === 403)
    msg = "Key không có quyền gọi Gemini. Nếu key bị giới hạn theo website (HTTP referrer), hãy thêm tên miền này vào danh sách cho phép.";
  else if (status === 404) msg = `Model "${model}" không tồn tại hoặc key không dùng được model này. Đổi tên model trong Cài đặt.`;
  else if (status === 429) msg = "Đã hết quota hoặc gọi quá nhanh. Đợi một lúc rồi thử lại.";
  else if (status >= 500) msg = `Máy chủ Gemini đang lỗi (${status}). Thử lại sau ít phút.`;
  else msg = `Gemini báo lỗi ${status}.`;
  return new AnalyzeError(msg, body);
}

// Model đôi khi bỏ sót mảng rỗng / trả null. Điền mặc định để renderer không sập;
// không có panel nào thì coi như hỏng.
export function normalizeDoc(d: ChartDocument): ChartDocument {
  if (!d || !Array.isArray(d.panels) || d.panels.length === 0) throw new Error("no panels");
  const fixPanel = (p: Panel) => {
    p.series = (p.series ?? []).map((s) => ({ ...s, points: s.points ?? [] }));
    p.referenceLines = p.referenceLines ?? [];
    p.legends = p.legends ?? [];
    p.insets = (p.insets ?? []).map(fixPanel);
    p.xAxis.ticks = p.xAxis.ticks ?? [];
    p.yAxis.ticks = p.yAxis.ticks ?? [];
    if (!p.title) delete p.title;
    return p;
  };
  d.panels = d.panels.map(fixPanel);
  d.freeTexts = d.freeTexts ?? [];
  d.background = d.background || "#FFFFFF";
  d.defaultFontFamily = d.defaultFontFamily || "Arial";
  return d;
}

export async function analyzeChart(
  file: File,
  cfg: GeminiConfig,
  signal?: AbortSignal
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new AnalyzeError("Không kết nối được tới Gemini. Kiểm tra mạng rồi thử lại.", String(e));
  }

  if (!res.ok) {
    throw friendlyHttpError(res.status, await res.text(), cfg.model);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
    undefined;

  if (!text) {
    throw new AnalyzeError("Gemini không trả về kết quả (có thể ảnh bị chặn bởi bộ lọc an toàn). Thử lại.", JSON.stringify(data).slice(0, 2000));
  }

  try {
    return normalizeDoc(parseJsonLoose(text));
  } catch (e) {
    throw new AnalyzeError("Kết quả của Gemini bị lỗi định dạng. Bấm phân tích lại.", text.slice(0, 2000));
  }
}
