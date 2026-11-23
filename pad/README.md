# PAD Classification

<img src="../logo.svg" width="48" alt="">

Mục `pad/` của [Trieu's Note](../README.md). Giao diện tiếng Anh, tính toàn bộ trên trình duyệt, không cần đăng nhập.

🔗 https://theodore-ng.github.io/trieus-note/pad/

Phân loại bệnh động mạch chi dưới (peripheral arterial disease):

- **Fontaine** (I, IIa, IIb, III, IV) từ ABI, đau cách hồi + quãng đường đi không đau, đau khi nghỉ, mất mô.
- **Rutherford** (Grade 0–3 / Category 0–6) từ triệu chứng, mức mất mô so với khớp cổ–bàn ngón, áp lực cổ chân/ngón, test thảm lăn.
- **WIfI** (Wound, Ischemia, foot Infection) → giai đoạn nguy cơ cắt cụt 1 năm và lợi ích tái thông mạch (Mills 2014, Table VI–VII); I lấy mức nặng nhất trong ABI, áp lực cổ chân, áp lực ngón, TcPO₂.

Kèm cảnh báo lâm sàng (ABI > 1,3, thiếu dữ liệu huyết động…). Chỉ là công cụ hỗ trợ quyết định, không thay thế đánh giá lâm sàng.

Logic ở `pad/classification.js`, chuyển nguyên trạng từ bản Python gốc `scripts/pad/classification.py` (repo `pad-classification` cũ, PyScript). Khi sửa logic: sửa cả hai, chạy `pytest scripts/pad/tests` (47 test) rồi `scripts/pad/parity.py` (so JS với Python trên lưới đầu vào quanh mọi ngưỡng, phải "OK").

## Tệp

```
index.html               Giao diện 3 tab Fontaine / Rutherford / WIfI
classification.js        Logic (bản chuyển từ ../scripts/pad/classification.py)
app.js                   Đọc form, hiện kết quả ngay khi nhập
../scripts/pad/          Bản Python chuẩn, 47 test (pytest), parity.py so JS với Python
```
