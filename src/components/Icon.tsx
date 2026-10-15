// Bộ icon nét mảnh (viewBox 24), tự vẽ để không thêm thư viện.
const PATHS: Record<string, string[]> = {
  undo: ["M9 14 4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-3"],
  redo: ["m15 14 5-5-5-5", "M20 9H9a5 5 0 0 0 0 10h3"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  fit: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M5 20h14"],
  settings: ["M4 7h9", "M17 7h3", "M4 17h3", "M11 17h9", "M15 5v4", "M9 15v4"],
  image: ["M3 5h18v14H3z", "m3 16 5-5 4 4 3-3 6 6", "M8.5 8.5h.01"],
  sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 16v4", "M17 18h4"],
  trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  copy: ["M8 8h12v12H8z", "M4 16V4h12"],
  up: ["m6 15 6-6 6 6"],
  down: ["m6 9 6 6 6-6"],
  left: ["m15 6-6 6 6 6"],
  right: ["m9 6 6 6-6 6"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  folder: ["M3 6h6l2 2h10v11H3z"],
  text: ["M5 6h14", "M12 6v13"],
  axis: ["M5 4v15h15"],
  series: ["m4 16 5-6 4 4 7-8"],
  bars: ["M5 20V10", "M10 20V4", "M15 20v-7", "M20 20V8"],
  compare: ["M12 3v18", "M4 6h5v12H4z", "M15 6h5v12h-5z"],
  key: ["M14 10a4 4 0 1 0-1.2 2.8L20 20", "M17 17l2-2"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"],
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export type IconName = keyof typeof PATHS;
