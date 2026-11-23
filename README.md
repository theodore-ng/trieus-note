# Trieu's Note

<img src="logo.svg" width="64" alt="">

App cá nhân gồm nhiều mục con, mở từ trang chủ dạng thẻ, dùng chung một tài khoản đăng nhập:

| Mục | Đường dẫn | Nội dung |
|---|---|---|
| **Ghi chú** | `notes/` | Ghi chép cá nhân: tạo, sửa (tự lưu), Markdown Viết/Xem, checklist tick được, nhãn, ghim, lưu trữ, thùng rác (tự xóa sau 30 ngày), tìm kiếm không dấu, xuất/nhập sao lưu JSON |
| **Quản lý tài chính** | `finance/` | Mô tả chi tiết bên dưới |
| **Danh mục kỹ thuật** | `ky-thuat/` | Tra cứu danh mục kỹ thuật tương đương (QĐ 4442/4883) kèm quy trình kỹ thuật khoa Phẫu thuật mạch máu; dữ liệu nằm sẵn trong trang, không cần đăng nhập |
| **PAD Classification** | `pad/` | Phân loại bệnh động mạch chi dưới: Fontaine, Rutherford, WIfI (giao diện tiếng Anh, tính trên trình duyệt, không cần đăng nhập) |
| **Heparin IV Calc.** | `heparin/` | Liều heparin IV theo cân nặng, chỉnh liều theo aPTT (Dager 2018); giao diện tiếng Anh, tính trên trình duyệt |

🔗 **https://theodore-ng.github.io/trieus-note/** (trước đây: `gold-portfolio`)

Dữ liệu cá nhân chỉ nằm ở Supabase (khi đăng nhập, bảo vệ bằng Row Level Security) hoặc trong trình duyệt (chế độ cục bộ khi `config.js` để trống). Phiên đăng nhập dùng chung giữa các mục vì cùng origin.

---

# Danh mục kỹ thuật

Trang tra cứu (`ky-thuat/`) phụ lục **danh mục kỹ thuật tương đương** (QĐ 4442/4883 – 8.924 kỹ thuật, 28 chương) kèm **41 quy trình kỹ thuật** của khoa Phẫu thuật mạch máu. Dữ liệu nằm sẵn trong trang, không cần đăng nhập, không gửi dữ liệu đi đâu.

## Tính năng

- **Tìm kiếm** theo tên hoặc mã, không phân biệt dấu ("dat catheter" ra "Đặt catheter"); lọc **Tất cả / Phẫu thuật / Thủ thuật**.
- **Thẻ kết quả** gọn: tên, mã, lĩnh vực (chương), tuyến, phân loại; bấm **Chi tiết** để xem tên tương đương TT15, giá TT15 / TT37 / TT02, mã BHYT, ghi chú, quyết định, nút mở quy trình kỹ thuật của khoa.
- **Giải thích theo văn bản** trong Chi tiết từng kỹ thuật, tính cho chính dòng đó: ý nghĩa tuyến (TT43/2013) và mã kỹ thuật còn dùng đến khi nào (TT23/2024 sửa đổi 2026); phân loại và định mức nhân lực tối đa mỗi ca theo chuyên khoa (TT50/2014 Phụ lục 1); giá nào áp dụng khi có / không có BHYT; tỷ lệ thanh toán khi làm kèm trong cùng lần phẫu thuật.
- **Văn bản tham chiếu** ở trang đầu: mỗi văn bản có **Chi tiết** gồm tóm tắt, ngày ký/hiệu lực, hiệu lực hiện nay, **văn bản thay thế, sửa đổi** và link nguồn.
- **Danh sách quy trình khoa** chia Phẫu thuật / Can thiệp mạch / Thủ thuật; mỗi quy trình mở thành trang đọc, nút Back của điện thoại quay lại.

## Hiệu lực của dữ liệu (kiểm tra 20/11/2026)

| Nội dung trong trang | Văn bản gốc | Tình trạng |
|---|---|---|
| Danh mục tương đương | QĐ 4442, 4883/QĐ-BYT (2018) | Đã bị **QĐ 7435/QĐ-BYT** thay thế từ 15/12/2018; dữ liệu trong trang vẫn là bản 4442/4883 |
| Mã kỹ thuật, tuyến A–D | TT43/2013, TT21/2017 | Hết hiệu lực từ 18/10/2024 (TT23/2024). Mã theo chương **vẫn là mã kỹ thuật** ở Phụ lục 01 TT23/2024, dùng **đến hết 31/12/2027** (Thông tư sửa đổi 2026); Phụ lục 02 áp dụng từ 01/01/2028 |
| Phân loại PĐB–P3, TĐB–T3 | TT50/2014 | Còn áp dụng; TT23/2024 giữ nguyên mức phân loại cho kỹ thuật Phụ lục 01 |
| Giá TT15 (BHYT) | TT15/2018 | Giá năm 2018. Đã thay bằng TT39/2018 → TT22/2023 (hết hiệu lực 01/01/2025 theo TT21/2024) |
| Giá TT37 (không BHYT) | TT37/2018 | Khung giá năm 2019. Đã thay bằng TT14/2019 (phụ lục) → TT21/2023 → hết hiệu lực 01/01/2025 theo TT21/2024 |
| Giá TT02 | TT02/2017 | Hết hiệu lực từ 15/01/2019 |

Tóm tắt văn bản chỉ để tham khảo nhanh; khi dùng chính thức cần đối chiếu văn bản gốc.

## Điểm chưa làm rõ

- **Giá BHYT hiện hành:** chưa xác định được bảng giá áp dụng chung toàn quốc sau 01/01/2025. Theo TT21/2024, HĐND cấp tỉnh quy định giá cụ thể thuộc thẩm quyền, không vượt giá cao nhất do Bộ trưởng Bộ Y tế quy định; giá thực tế cần tra tại cơ sở hoặc văn bản giá của tỉnh.
- **Số hiệu Thông tư sửa đổi năm 2026** (sửa TT23/2024, TT32/2023, TT01/2013, TT42/2025; Điều 3 hiệu lực 01/07/2026): bản PDF trên chinhphu.vn để trống số; trang tra cứu ghi 25/2026/TT-BYT. Trong trang ghi là "Thông tư sửa đổi năm 2026".
- **TT21/2023/TT-BYT** (khung giá không BHYT): chưa đọc được nguyên văn; việc TT21/2023 thay TT37/2018 và TT14/2019 mới thấy ở trang tra cứu văn bản.
- **Văn bản thay thế QĐ 7435:** chưa tìm thấy. Muốn cập nhật dữ liệu sang QĐ 7435 cần file Excel phụ lục của quyết định này.
- **Cột TT37 "có lương / không lương":** TT37/2018 không nêu rõ khi nào áp dụng mức nào; trang chỉ ghi là hai mức của khung giá.
- **Định mức nhân lực TT50 Phụ lục 1:** lấy từ bản đăng lại (caselaw.vn) vì không mở được file gốc; mỗi ô đã cộng kiểm tra. Các ô nguồn ghi lệch hoặc không tách được loại để trống, trang hiện "xem Phụ lục 1 TT50/2014": phẫu thuật Điện quang, Vi phẫu, Tạo hình thẩm mỹ loại III; thủ thuật Lao, Tâm thần, Y học cổ truyền, Giải phẫu bệnh, Tai Mũi Họng loại đặc biệt, Y học hạt nhân loại II–III. Các chương Hóa sinh, Vi sinh và phẫu thuật Gây mê hồi sức không có bảng. Nên đối chiếu file gốc trước khi dùng chính thức.

---

# PAD Classification

Trang `pad/` phân loại bệnh động mạch chi dưới (peripheral arterial disease):

- **Fontaine** (I, IIa, IIb, III, IV) từ ABI, đau cách hồi + quãng đường đi không đau, đau khi nghỉ, mất mô.
- **Rutherford** (Grade 0–3 / Category 0–6) từ triệu chứng, mức mất mô so với khớp cổ–bàn ngón, áp lực cổ chân/ngón, test thảm lăn.
- **WIfI** (Wound, Ischemia, foot Infection) → giai đoạn nguy cơ cắt cụt 1 năm và lợi ích tái thông mạch (Mills 2014, Table VI–VII); I lấy mức nặng nhất trong ABI, áp lực cổ chân, áp lực ngón, TcPO₂.

Kèm cảnh báo lâm sàng (ABI > 1,3, thiếu dữ liệu huyết động…). Chỉ là công cụ hỗ trợ quyết định, không thay thế đánh giá lâm sàng.

Logic ở `pad/classification.js`, chuyển nguyên trạng từ bản Python gốc `scripts/pad/classification.py` (repo `pad-classification` cũ, PyScript). Khi sửa logic: sửa cả hai, chạy `pytest scripts/pad/tests` (47 test) rồi `scripts/pad/parity.py` (so JS với Python trên lưới đầu vào quanh mọi ngưỡng, phải "OK").

---

# Heparin IV Calc.

Trang `heparin/` tính liều heparin không phân đoạn truyền tĩnh mạch theo Dager 2018 (ASHP, Table 3-5):

| Chỉ định | Bolus | Truyền | aPTT đích | Theo dõi |
|---|---|---|---|---|
| VTE (DVT/PE) | 80 IU/kg | 18 IU/kg/giờ | 60–100 giây | aPTT |
| STEMI + rt-PA liều đầy đủ | 60 IU/kg (tối đa 4.000) | 12 IU/kg/giờ (tối đa 1.000/giờ) | 50–70 giây | aPTT |
| STEMI + rt-PA phối hợp | 60 IU/kg (tối đa 3.000) | 7 IU/kg/giờ (tối đa 800/giờ) | 50–70 giây | aPTT |
| NSTEMI / đau thắt ngực không ổn định | 60 IU/kg (tối đa 4.000) | 12 IU/kg/giờ (tối đa 1.000/giờ) | 50–70 giây | aPTT |
| PCI + GP IIb/IIIa | 50–70 IU/kg | — | — | ACT |
| PCI đơn thuần | 70–100 IU/kg | — | — | ACT |

Nồng độ = IU trong túi / mL dung môi; mL làm tròn 1 chữ số thập phân; tốc độ không âm. Chỉnh liều theo bảng aPTT của từng nhóm (VTE; tim mạch). Chỉ là công cụ hỗ trợ, bác sĩ phải kiểm tra liều trước khi dùng.

Logic ở `heparin/heparin.js`, chuyển nguyên trạng từ bản TypeScript gốc `scripts/heparin/*.ts` (repo `heparin-web-app` cũ). Khi sửa logic: sửa cả hai rồi chạy `scripts/heparin/parity.py` (dịch chính file .ts trong Edge và so với JS, phải "OK").

**Cần rà lại (giữ nguyên từ bản gốc):** bảng chỉnh liều tim mạch được bản gốc ghi là "adapted from standard protocol", không lấy trực tiếp từ Dager; mục Safety notes ghi "aPTT > mức trên của đích thì ngưng 1 giờ" nhưng bảng chỉ ngưng khi aPTT > 120 (VTE) / > 90 giây (tim mạch).

---

# Quản lý tài chính

Web app cá nhân quản trị danh mục **vàng, tiền mặt, tiết kiệm, chứng khoán và tài sản khác** và chuyển dần sang danh mục tối ưu theo phương pháp **CFA**, có điều chỉnh theo dữ liệu thị trường Việt Nam và thế giới.

> Công cụ theo dõi và lập kế hoạch, **không phải khuyến nghị đầu tư**. Kết quả tối ưu và mô phỏng phụ thuộc hoàn toàn vào giả định.

---

## Tính năng

Cấu trúc theo quy trình quản lý danh mục (CFA): lập kế hoạch → thực thi → theo dõi và đánh giá.

| Tab | Mục | Nội dung |
|---|---|---|
| **Danh mục** | Tổng quan | Giá trị tài sản ròng (NAV), thay đổi so với hôm trước, lãi/lỗ lũy kế (chưa chốt, đã chốt, lãi tiền gửi), giá SJC mua/bán và premium, cơ cấu tài sản hiện tại |
| | Nắm giữ & giao dịch | Mỗi lớp tài sản một khối: khớp số thực tế, bán vàng (FIFO), mua lô, gửi/tất toán tiền gửi, thu/chi tiền mặt, chứng khoán, lịch sử giao dịch |
| | Hiệu quả | Diễn biến giá trị danh mục; kiểm định quá khứ: nếu đã tái cơ cấu theo phân bổ chiến lược từ 1/6/12 tháng trước, chia theo từng lớp tài sản |
| **Thị trường** | Tin tức | Tin kinh tế CafeF, Vietstock, VnEconomy (RSS), chủ đề nóng 7 ngày |
| | Vĩ mô & dòng tiền | Nhận định quý, chu kỳ kinh tế, kinh tế VN, dòng tiền liên thị trường, ngành được tập trung đầu tư, rủi ro suy thoái, lạm phát & sức mua |
| | Vàng Việt Nam | Premium so với thế giới, chênh lệch mua–bán, cung cầu, độ ổn định, mốc xác nhận đáy sau đỉnh, bảng yếu tố kỳ vọng, bối cảnh chính sách |
| **Chiến lược** | Phân bổ chiến lược | Giả định kỳ vọng thị trường (CME); so sánh hiện trạng với 3 phân bổ tối ưu theo khẩu vị rủi ro (Thận trọng / Cân bằng / Tăng trưởng) |
| | Dự phóng | Monte Carlo 2.000 kịch bản (1/3/5/10 năm): danh mục mục tiêu so với hiện trạng, kịch bản xấu/tốt, sụt giảm tối đa, thu nhập thụ động, điểm hòa giá vàng |
| | Điều chỉnh chiến thuật | Nút **Phân tích lại toàn bộ**: tải dữ liệu mới, chấm điểm tín hiệu vàng, vĩ mô, lãi suất, dòng tiền cho từng lớp tài sản, đề xuất nghiêng tỷ trọng ±5 điểm % quanh SAA (TAA), so sánh trước–sau; bấm Áp dụng mới đổi mục tiêu (`taa.js`) |
| **Thực thi** | Việc cần làm | Việc cần làm trong ngày; khối thu gọn Giảm tỷ trọng vàng (số lượng giữ lại, lịch bán theo tháng; mỗi đợt tăng/giảm/tạm dừng theo premium SJC và giá vàng thế giới); rà soát danh mục (tính trên trình duyệt) |
| | Giải ngân | Số tiền và số chứng chỉ quỹ ETF mua mỗi tháng (DCA), quỹ mở, cổ phiếu đáng quan tâm kèm chỉ số tài chính và cảnh báo rủi ro |
| **Tài khoản** | | Đăng nhập Supabase, đồng bộ giữa các thiết bị, xuất/nhập sao lưu JSON; giới thiệu |

## Phương pháp phân bổ (CFA Level III)

1. **Kỳ vọng thị trường (CME)** cho từng lớp tài sản, tính lại khi dữ liệu thay đổi:
   - *Tiết kiệm:* lãi hiện tại cho năm đầu, lãi dài hạn cho các năm sau.
   - *Trái phiếu:* trung vị lợi nhuận 12 tháng của các quỹ trái phiếu (≈ lợi suất hiện tại).
   - *Cổ phiếu:* Grinold–Kroner (cổ tức + tăng trưởng thực + lạm phát − pha loãng), điều chỉnh theo xu hướng VN-Index (MA200) và mức rủi ro suy thoái.
   - *Vàng:* kỳ vọng vàng thế giới trừ phần premium SJC dự kiến co lại, cộng thêm khi lạm phát cao.
   - *Vệ tinh (tự giao dịch):* alpha = 0, biến động cao hơn.
2. **Tối ưu trung bình–phương sai:** tối đa U = E(R) − ½·λ·σ² với λ = 8 / 4 / 2, dưới các ràng buộc IPS: quỹ khẩn cấp, vàng tối thiểu/tối đa, trần cổ phiếu và vệ tinh.

Mọi giả định và ràng buộc chỉnh được trong mục *Giả định*. Logic nằm ở `plan.js` (`cme()`, `optimize()`, `simulate()`).

## Kiến trúc

```
index.html, core.js        Trang chủ Trieu's Note: đăng nhập dùng chung, lưới thẻ các mục
style.css, config.js       Giao diện chung (HTML/CSS/JS thuần, không cần build); URL + khóa publishable Supabase (để trống = chế độ cục bộ)
notes/                     Ghi chú (notes.js: danh sách, tìm kiếm, sửa tự lưu)
finance/index.html         Quản lý tài chính (+ Chart.js)
finance/app.js             Trạng thái, giao dịch, lộ trình bán vàng, biểu đồ, đăng nhập/lưu trữ
finance/plan.js            CME, tối ưu danh mục, thẻ hồ sơ, Monte Carlo
finance/taa.js             Điều chỉnh chiến thuật (TAA): tín hiệu, mức nghiêng, áp dụng vào mục tiêu
finance/invest.js          Hướng dẫn giải ngân (ETF, quỹ mở, cổ phiếu)
finance/macro.js           Vĩ mô, dòng tiền, rủi ro suy thoái, lạm phát
supabase/schema.sql        Bảng portfolios/profiles/notes + Row Level Security
ky-thuat/index.html        Danh mục kỹ thuật (sinh bởi scripts/ky_thuat/, không sửa tay)
pad/                       PAD Classification (classification.js = logic, app.js = giao diện)
scripts/pad/               Bản Python chuẩn, 47 test, parity.py so JS với Python
heparin/                   Heparin IV Calc. (heparin.js = logic, app.js = giao diện)
scripts/heparin/           Bản TypeScript gốc, parity.py so JS với TS
scripts/update_prices.py   → data/prices.json, data/macro.json
scripts/update_invest.py   → data/invest.json
data/vn_macro.json         Số liệu vĩ mô VN (cập nhật thủ công hằng tháng)
.github/workflows/prices.yml  Chạy 2 script 4 lần/ngày (9:15, 11:15, 14:15, 17:15 giờ VN) và commit dữ liệu
```

### Nguồn dữ liệu

| Dữ liệu | Nguồn | Cập nhật |
|---|---|---|
| Giá vàng SJC, nhẫn | PNJ (trình duyệt gọi trực tiếp khi mở trang + lưu lịch sử) | Thời gian thực / 4 lần/ngày |
| Vàng TG, USD/VND, chỉ số, hàng hóa, VIX | Yahoo Finance | 4 lần/ngày |
| Đường cong lợi suất, quy tắc Sahm, xác suất suy thoái, chênh lệch HY, CPI Mỹ | FRED | 4 lần/ngày |
| Lạm phát VN theo năm | World Bank | 4 lần/ngày |
| VN-Index, giá ETF và cổ phiếu, P/E, P/B, ROE… | VNDirect | 4 lần/ngày |
| Quỹ mở trái phiếu/cổ phiếu (NAV, hiệu suất, phí) | fmarket | 4 lần/ngày |
| CPI, GDP, tín dụng, đầu tư công VN | Cục Thống kê, NHNN, Bộ Tài chính | Thủ công hằng tháng (`data/vn_macro.json`) |

Giá SJC trước ngày bắt đầu theo dõi là **ước tính** (giá thế giới quy đổi × premium lần đo đầu tiên) và được vẽ nét đứt.

## Bảo mật & quyền riêng tư

- Repo này **không chứa dữ liệu tài sản cá nhân**. Dữ liệu nằm trong bảng `portfolios` của Supabase, được bảo vệ bằng Row Level Security: mỗi người chỉ đọc/ghi được dòng của mình. Ở chế độ cục bộ, dữ liệu nằm trong `localStorage` của trình duyệt.
- `config.js` chỉ chứa khóa **publishable/anon** (được phép công khai). **Không bao giờ** đặt khóa `service_role`/secret vào repo.
- Tự đăng ký đã tắt: tài khoản do quản trị viên tạo trong Supabase. Vai trò (`admin`/`user`) lưu ở bảng `profiles` và không thể tự sửa qua API.

## Cài đặt

### Chạy trên máy

```bash
python -m http.server 8000      # trong thư mục repo, rồi mở http://localhost:8000
```

Để trống `supabaseUrl`/`supabaseKey` trong `config.js` sẽ chạy chế độ cục bộ, không cần đăng nhập.

### Bật đăng nhập (Supabase)

1. Tạo project trên [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → Email**: tắt *Allow new users to sign up*.
3. **Authentication → Users → Add user**: email dạng `<tên>@quyvang.app`, tích *Auto Confirm User*. Người dùng đăng nhập bằng `<tên>`; tên miền đặt ở `emailDomain` trong `config.js`.
4. **SQL Editor**: chạy `supabase/schema.sql`, rồi chạy câu lệnh gán quyền admin ở cuối file (bỏ chú thích, thay `<ten>`).
5. Điền **Project URL** và **Publishable key** vào `config.js`.

### Cập nhật dữ liệu bằng tay

```bash
pip install -r scripts/requirements.txt
python scripts/update_prices.py && python scripts/update_invest.py
```

## Bảo trì

- **Danh mục kỹ thuật** (khi có phụ lục Excel hoặc file quy trình Word mới; cần `openpyxl`, `python-docx`; file nguồn không đưa vào repo):
  ```sh
  python scripts/ky_thuat/docx2procs.py "QUY TRINH KT KHOA PTMM.docx" procs.json
  python scripts/ky_thuat/build.py "<file phụ lục>.xlsx" scripts/ky_thuat/template.html page.html procs.json
  python scripts/ky_thuat/make_index.py page.html ky-thuat/index.html
  ```
  Sửa giao diện ở `template.html` rồi build lại; `make_index.py` lấy số phiên bản theo `index.html` gốc nên chạy sau khi tăng `?v=`.

- **Mỗi lần deploy:** tăng `?v=` của các file css/js trong mọi `index.html` (gốc, `notes/`, `finance/`). GitHub Pages cache 10 phút, nếu không tăng thì người dùng có thể thấy bản cũ.
- **Hằng tháng** (sau khi Cục Thống kê công bố, khoảng ngày 6): cập nhật `data/vn_macro.json`, ghi nguồn và kỳ số liệu, đổi `asOf`.
- **Khi có sự kiện doanh nghiệp:** cập nhật `RISK_NOTES` trong `scripts/update_invest.py`, luôn ghi nguồn. Danh sách mã theo dõi nằm ở `STOCKS` và `ETFS`.
- **Khi đổi phương pháp hoặc giả định mặc định** trong `plan.js`: tăng `PLAN_VERSION` để dữ liệu cũ của người dùng chuyển sang giả định mới.
