# ToolChart

Webapp: chuyển **ảnh biểu đồ (PNG/JPG)** → **vector chỉnh sửa được** → xuất **SVG / PDF**.

Luồng: `Ảnh → Gemini Vision bóc ra JSON → Renderer vẽ lại SVG → chỉnh màu/font/marker → export`.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173

1. Dán **Gemini API Key** (lưu trong localStorage trình duyệt, không nằm trong code).
2. Model mặc định `gemini-3.1-pro-preview` — sửa được ở ô Model.
3. Tải ảnh biểu đồ lên → **Phân tích**.
4. **Chỉnh sửa trực tiếp trên canvas:** click vào 1 thanh/điểm/chữ để chọn (viền xanh), **kéo để chỉnh giá trị**, hoặc nhập số chính xác ở panel "Phần tử đang chọn". Thêm/xoá/nhân đôi điểm & series, sửa error bar, toggle tô đặc/viền-trắng. (Gemini hay bỏ sót thanh viền-trắng → bấm **Nhân đôi series** rồi chỉnh.)
5. Cột trái còn có chỉnh nhanh: màu, marker, kiểu nét, font, tiêu đề, nhãn trục.
6. **Xuất SVG** hoặc **Xuất PDF**.

Bấm **Dùng mẫu** để xem pipeline chạy mà không cần API key.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `src/types/chart.ts` | Schema JSON mô tả biểu đồ (panel, inset, series, error bars, reference line, legend) |
| `src/services/prompt.ts` | Prompt yêu cầu Gemini trả JSON đúng schema |
| `src/services/gemini.ts` | Gọi Gemini REST từ trình duyệt, parse JSON |
| `src/render/ChartSvg.tsx` | Renderer: JSON → SVG (panel/inset đệ quy) + context chọn/kéo trên canvas |
| `src/editor/util.ts` | Selection, inverse-scale (pixel → giá trị), helper duyệt/tìm panel |
| `src/components/SelectionPanel.tsx` | UI sửa phần tử đang chọn: số chính xác, error bar, thêm/xoá điểm & series |
| `src/components/EditPanel.tsx` | UI chỉnh nhanh màu/marker/nét/font/nhãn |
| `src/utils/export.ts` | Xuất SVG / PDF |
| `src/sample/example.ts` | Dữ liệu mẫu xấp xỉ ảnh input |

## Quyết định kiến trúc

- **Pure frontend**, không backend: key do người dùng tự nhập ở UI, gọi thẳng Gemini (endpoint có CORS). Deploy static (Vercel). Thêm backend sau nếu cần giấu key / dùng model tự host — frontend không đổi.
- Renderer vẽ SVG thủ công (không dùng Recharts/D3 chart) để tái tạo **chính xác** bố cục bất kỳ: multi-panel, inset lồng, error bars 2 chiều, nhiều legend.
