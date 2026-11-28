# Tóm tắt bệnh án (Case Summary)

<img src="../logo.svg" width="48" alt="">

Mục `ttba/` của [Trieu's Note](../README.md). Giao diện tiếng Việt, làm cho iPhone (Safari, có thể "Thêm vào Màn hình chính").

🔗 https://theodore-ng.github.io/trieus-note/ttba/

Bác sĩ đọc thông tin ca bệnh thành từng đoạn (không cần theo thứ tự bệnh án), Claude chuẩn hóa thuật ngữ và xếp vào mẫu tóm tắt bệnh án; bác sĩ duyệt, bổ sung rồi xuất.

## Cách dùng

0. **Xem ca mẫu** (ở danh sách ca): mở một ca bệnh nhân giả đã sắp xếp sẵn để xem giao diện, không cần khóa API.
1. **Cài đặt**: dán khóa API Claude (tạo ở platform.claude.com › API keys; nên đặt hạn mức chi tiêu), chọn model, sửa **từ điển cá nhân** (`cách đọc = cách viết`, vd `a bê i = ABI`).
2. **+ Ca mới**: đặt tên ẩn danh (vd "Giường 12 · Nam 68t").
3. **Ghi**: chọn chủ đề (không bắt buộc: Bệnh sử, Tiền sử, Khám, Mạch máu, CLS, Chẩn đoán, Điều trị, Ra viện), bấm nút đỏ để đọc, bấm lại để dừng; mỗi lần là một đoạn, sửa/xóa được. **Gõ tay** để nhập (hoặc dùng micro trên bàn phím iPhone).
4. **Sắp xếp →**: gửi các đoạn cho Claude, nhận bản theo mẫu (thường 15–60 giây).
5. **Duyệt**: mục **Chỉ số mạch máu** có nút **Phân độ**: chọn chân, triệu chứng nặng nhất, mức mất mô, W/fI, nhập ABI / áp lực cổ chân / áp lực ngón / TcPO₂ → tính Fontaine, Rutherford, WIfI (khi đau khi nghỉ hoặc mất mô) và chèn một dòng "- Phân độ (chân …): …" vào mục (thay dòng Phân độ cũ nếu có); dữ liệu nhập được nhớ theo ca. Mục trống nền vàng (chạm 🎤 để nói thẳng vào mục), chỗ cần kiểm tra màu cam (số liệu, liều, ICD-10), danh sách thuật ngữ đã chuẩn hóa. Ghi thêm đoạn rồi **Sắp xếp thêm**: Claude giữ phần đã sửa, chỉ bổ sung.
6. **Xuất**: chép toàn bộ (dán vào phần mềm bệnh viện), tải Word (.doc), chia sẻ qua Bảng chia sẻ iOS. Bản xuất chỉ gồm các mục có nội dung.

## Mẫu (mẫu chung, chỉnh sau)

Người bệnh (ẩn danh) · Ngày vào viện · Lý do vào viện · Bệnh sử · Tiền sử · Khám lâm sàng · **Chỉ số mạch máu** (ABI/TBI, Doppler, Rutherford / Fontaine / WIfI, CEAP) · Cận lâm sàng · Chẩn đoán vào viện · Chẩn đoán xác định / ra viện (ICD-10 gợi ý) · Phương pháp điều trị · Tình trạng người bệnh · Hướng điều trị tiếp. Sửa danh sách ở `FIELDS` trong `ttba.js` (schema JSON và bản xuất tự theo).

## Kỹ thuật

- **Giọng nói → chữ**: Web Speech API của Safari (`vi-VN`, nhận dạng của Apple), tự bật lại khi iOS ngắt sau khoảng lặng; giữ màn hình sáng khi ghi (Wake Lock). Không có thì gõ hoặc dùng micro bàn phím. Không lưu file âm thanh.
- **Chữ → mẫu**: Claude qua `@anthropic-ai/sdk@1.8.0` (ESM từ jsDelivr, `dangerouslyAllowBrowser` vì khóa do người dùng tự dán trên máy mình); mặc định `claude-opus-5-5`, effort `medium`, đầu ra `output_config.format` = JSON schema (13 mục + `can_kiem_tra` + `chuan_hoa`); Opus/Sonnet bật `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) khi bị bộ lọc an toàn từ chối. Ước tính chi phí hiện dưới tab Duyệt.
- **Dữ liệu**: localStorage của trình duyệt (`trieusnote_ttba_v1` ca bệnh, `trieusnote_ttba_cfg` cài đặt + khóa). Từ 2.12.0, khi đã đăng nhập Trieu's Note thì ca bệnh đồng bộ lên Supabase, bảng `ttba_cases` (`id`, `user_id`, `data` jsonb = cả ca, `updated_at`; RLS theo người dùng; SQL trong `supabase/schema.sql`). Ca sửa sau cùng được giữ; ca đã đồng bộ mà Supabase không còn thì coi như đã xóa ở máy khác; mất mạng thì các lần xóa được nhớ trong `S.gone` để làm sau. Khóa API và cài đặt không đồng bộ. Tự xóa ca không sửa sau N ngày (mặc định 30), áp dụng cả trên Supabase. Ngoài Supabase (khi đăng nhập), nội dung chỉ rời máy khi bấm Sắp xếp (gửi tới API Claude).
- **Ẩn danh**: nhắc không đọc họ tên/số hồ sơ; trước khi gửi, quét các dấu hiệu định danh (tên, dãy số giống SĐT/căn cước, số hồ sơ) và hỏi lại; Claude được dặn thay bằng `[ẩn]`.
- **Phân độ PAD**: `pad.js` = logic của app PAD Classification cũ (đã gộp vào đây từ 3.0.0), chuyển nguyên trạng từ `scripts/pad/classification.py`; sửa logic phải sửa cả hai, chạy `pytest scripts/pad/tests` và `scripts/pad/parity.py` (phải OK). Cảnh báo lâm sàng giữ tiếng Anh như bản gốc (để parity khớp); mô tả giai đoạn hiển thị tiếng Việt trong `ttba.js`.
- Kiểm thử: `window.__TTBA_MOCK__` thay lời gọi Claude bằng hàm giả (không tốn phí, không gửi dữ liệu).

## Điểm cần lưu ý

- Dữ liệu sức khỏe là dữ liệu cá nhân nhạy cảm (NĐ 13/2023/NĐ-CP, Luật Bảo vệ dữ liệu cá nhân 2025). Khi đồng bộ, ca bệnh nằm trên Supabase ở dạng đọc được (không mã hóa đầu-cuối, người dùng chọn) và máy chủ ở nước ngoài; đối chiếu quy định của bệnh viện trước khi dùng với ca thật.
- Mã ICD-10 và mọi nội dung do AI sắp xếp phải được bác sĩ kiểm tra.
- Nhận dạng tiếng Việt của Safari trên iPhone cần thử thực tế (quyền Micro + Nhận dạng giọng nói khi bấm ghi lần đầu).
