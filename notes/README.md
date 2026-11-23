# Notes

<img src="../logo.svg" width="48" alt="">

Mục `notes/` của [Trieu's Note](../README.md): ghi chép cá nhân. Giao diện tiếng Anh.

🔗 https://theodore-ng.github.io/trieus-note/notes/

## Tính năng

- **Markdown** với chế độ **Edit / View**: tiêu đề, đậm, danh sách, bảng, link (mở tab mới). HTML được lọc an toàn bằng DOMPurify.
- **Checklist** `- [ ]` tick được ngay trong chế độ View.
- **Tag**: gắn nhiều tag, lọc theo tag, gợi ý tag đã có. **Pin** ghi chú quan trọng lên đầu.
- **Notes / Archive / Trash**: lưu trữ để ẩn khỏi danh sách chính; xóa vào Trash, khôi phục được, tự xóa hẳn sau 30 ngày; **Empty Trash** xóa vĩnh viễn tất cả.
- **Tìm kiếm** không phân biệt dấu (tiêu đề, nội dung, tag).
- **Paste**: tạo ghi chú từ chữ vừa sao chép (vd chọn chữ trong app Notes trên iPhone › Copy). Dòng đầu thành tiêu đề, tag `iPhone`; dán lại cùng nội dung không tạo bản trùng.
- **+ GitHub**: dán link repo → ghi chú tóm tắt và review (bên dưới).
- **Export backup**: tải toàn bộ ghi chú dạng JSON.
- Tự lưu khi gõ; ghi chú mới để trống tự bỏ khi chuyển sang ghi chú khác. Ghi chú đang mở nằm trong địa chỉ (`#<id>`), nút Back của điện thoại quay về danh sách.

## + GitHub

Bấm **+ GitHub**, dán link repo (`github.com/owner/repo`, kèm đường dẫn con cũng được). App gọi GitHub REST API công khai (không cần đăng nhập GitHub, giới hạn 60 lần/giờ/IP; repo riêng tư không đọc được) và tạo ghi chú:

- **Info:** tác giả, ngôn ngữ (≥ 1%), giấy phép, sao/fork, issue + PR đang mở, bản phát hành mới nhất, ngày tạo / lần push gần nhất, chủ đề.
- **Summary:** mô tả repo + đoạn văn mở đầu README (trước mục đầu tiên) + danh sách các mục của README.
- **Review** theo quy tắc (`github.js → review()`): phổ biến (sao), độ hoạt động (ngày từ lần push, archived), giấy phép (không có / dễ dùng lại / copyleft), tài liệu (README có cài đặt + cách dùng), phát hành, fork → điểm → *Worth trying* (≥ 3) / *Usable, check further* (≥ 1) / *Use with caution*. Không đánh giá chất lượng mã, không dùng AI.
- **My notes:** phần tự ghi. Dán lại cùng repo thì cập nhật số liệu, giữ nguyên phần này.

## Lưu trữ

- Đăng nhập: bảng `notes` trên Supabase (cột `title`, `body`, `pinned`, `archived`, `deleted_at`, `tags`; Row Level Security: mỗi người chỉ đọc/ghi ghi chú của mình). Tạo bảng bằng phần notes trong `../supabase/schema.sql` (chạy được nhiều lần).
- Chế độ cục bộ: `localStorage` khóa `trieusnote_notes_v1`; trạng thái giao diện ở `trieusnote_ui`.

## Tệp

```
index.html   Giao diện (marked + DOMPurify từ cdnjs)
notes.js     Danh sách, thư mục, tag, trình soạn, Markdown/checklist, Paste, Empty Trash, lưu trữ
github.js    Đọc link, gọi GitHub API, soạn ghi chú Info/Summary/Review
```

Địa chỉ `notes/#import&body=<URL-encoded text>[&title=…&folder=…]` tạo ghi chú từ phím tắt iOS (hỏi xác nhận trước).
