import { useCallback, useState } from "react";

// Lịch sử undo/redo cho document. Các thay đổi liên tiếp sát nhau (kéo chuột, gõ phím)
// gộp thành 1 bước để Ctrl+Z quay về trạng thái trước cả thao tác, không phải từng pixel.
const MERGE_MS = 400;
const LIMIT = 100;

interface State<T> {
  past: T[];
  present: T;
  future: T[];
  lastAt: number;
}

export function useHistory<T>(initial: T) {
  const [s, setS] = useState<State<T>>({ past: [], present: initial, future: [], lastAt: 0 });

  // set: thay đổi có ghi lịch sử. reset: nạp document mới, xoá lịch sử.
  const set = useCallback((next: T) => {
    setS((cur) => {
      const now = Date.now();
      const merge = now - cur.lastAt < MERGE_MS && cur.past.length > 0;
      const past = merge ? cur.past : [...cur.past, cur.present].slice(-LIMIT);
      return { past, present: next, future: [], lastAt: now };
    });
  }, []);
  const reset = useCallback((next: T) => setS({ past: [], present: next, future: [], lastAt: 0 }), []);
  const undo = useCallback(() => {
    setS((cur) =>
      cur.past.length === 0
        ? cur
        : { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future], lastAt: 0 }
    );
  }, []);
  const redo = useCallback(() => {
    setS((cur) =>
      cur.future.length === 0
        ? cur
        : { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1), lastAt: 0 }
    );
  }, []);

  return { present: s.present, set, reset, undo, redo, canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}
