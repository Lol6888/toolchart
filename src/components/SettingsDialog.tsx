import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Field } from "./ui";

export const KEY_HELP_URL = "https://aistudio.google.com/apikey";

export function KeyPrivacyNote() {
  return (
    <p className="muted">
      Key chỉ lưu trong trình duyệt này và được gửi thẳng tới Google. ToolChart không có máy chủ nên không nhìn thấy key của bạn.
    </p>
  );
}

export function SettingsDialog({
  apiKey,
  model,
  onSave,
  onClose,
}: {
  apiKey: string;
  model: string;
  onSave: (key: string, model: string) => void;
  onClose: () => void;
}) {
  const [k, setK] = useState(apiKey);
  const [m, setM] = useState(model);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-label="Cài đặt"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(k.trim(), m.trim() || model);
        }}
      >
        <header className="modal-head">
          <h3>Cài đặt AI</h3>
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Đóng">
            <Icon name="close" />
          </button>
        </header>
        <Field label="Gemini API key">
          <div className="inp-group">
            <input className="inp" type={show ? "text" : "password"} value={k} onChange={(e) => setK(e.target.value)} placeholder="AIza…" autoFocus />
            <button type="button" className="btn ghost sm" onClick={() => setShow(!show)}>
              {show ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </Field>
        <p className="muted">
          Chưa có key?{" "}
          <a href={KEY_HELP_URL} target="_blank" rel="noreferrer">
            Lấy miễn phí tại Google AI Studio
          </a>
          .
        </p>
        <KeyPrivacyNote />
        <Field label="Model" hint="Chỉ đổi khi Google đổi tên model hoặc báo model không tồn tại.">
          <input className="inp mono" value={m} onChange={(e) => setM(e.target.value)} />
        </Field>
        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn primary">
            Lưu
          </button>
        </footer>
      </form>
    </div>
  );
}
