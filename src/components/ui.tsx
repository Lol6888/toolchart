// Các ô nhập dùng chung cho Inspector / Cài đặt.
import { useState, type ReactNode } from "react";

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="insp-section">
      <header>
        <h4>{title}</h4>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={"fld" + (wide ? " wide" : "")}>
      <span className="fld-label">{label}</span>
      {children}
      {hint && <span className="fld-hint">{hint}</span>}
    </label>
  );
}

const parseNum = (t: string) => Number(t.trim().replace(",", "."));

// Ô số: giữ bản nháp khi đang gõ ("1.", "-", "0,5" đều gõ được), chỉ đẩy giá trị khi hợp lệ.
// Mũi tên lên/xuống tăng giảm theo step (giữ Shift = ×10).
export function NumInput({
  value,
  onChange,
  step = 1,
  allowEmpty = false,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : String(value));
  return (
    <input
      className="inp"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        if (t.trim() === "") {
          if (allowEmpty) onChange(undefined);
        } else if (Number.isFinite(parseNum(t))) onChange(parseNum(t));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
        const next = Math.round(((value ?? 0) + d) * 1e6) / 1e6;
        setDraft(null);
        onChange(next);
      }}
    />
  );
}

// Danh sách số "0, 20, 40" — áp dụng khi rời ô hoặc Enter (gõ dở không làm vỡ dữ liệu).
export function ListInput({ value, onChange, placeholder }: { value: number[]; onChange: (v: number[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const nums = draft
      .split(/[;,\s]+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    onChange(nums);
    setDraft(null);
  };
  return (
    <input
      className="inp"
      value={draft ?? value.join(", ")}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="inp" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // input[type=color] chỉ nhận #rrggbb; màu khác (vd "#000") vẫn hiện đúng ở ô chữ.
  const hex6 = /^#[0-9a-f]{6}$/i.test(value) ? value : /^#[0-9a-f]{3}$/i.test(value) ? "#" + value.slice(1).split("").map((c) => c + c).join("") : "#000000";
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="color-inp">
      <input type="color" value={hex6} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <input
        className="inp mono"
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value)) onChange(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

export function SelectInput<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className="inp" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Nhóm nút chọn 1 (thay select cho lựa chọn ít, nhìn thấy hết).
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
