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
  const base64 = await fileToBase64(file);
  const url = `${ENDPOINT}/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: EXTRACTION_PROMPT },
          { inline_data: { mime_type: file.type || "image/png", data: base64 } },
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
