# Quản lý tài chính (Finance)

<img src="../logo.svg" width="48" alt="">

Mục `finance/` của [Trieu's Note](../README.md): quản trị danh mục **vàng, tiền mặt, tiết kiệm, chứng khoán và tài sản khác**, chuyển dần sang danh mục tối ưu theo phương pháp **CFA**, có điều chỉnh theo dữ liệu thị trường Việt Nam và thế giới. Giao diện tiếng Việt.

🔗 https://theodore-ng.github.io/trieus-note/finance/

> Công cụ theo dõi và lập kế hoạch, **không phải khuyến nghị đầu tư**. Kết quả tối ưu và mô phỏng phụ thuộc hoàn toàn vào giả định.

## Tính năng

Cấu trúc theo quy trình quản lý danh mục (CFA): lập kế hoạch → thực thi → theo dõi và đánh giá.

| Tab | Mục | Nội dung |
|---|---|---|
| **Danh mục** | Tổng quan | Giá trị tài sản ròng (NAV) và nguyên nhân thay đổi so với phiên trước, biểu đồ 3M, tăng trưởng tổng tài sản (CAGR), thu nhập thụ động, tiến độ giảm tỷ trọng vàng, cơ cấu tài sản hiện tại so với mục tiêu |
| | Nắm giữ & giao dịch | Mỗi lớp tài sản một khối: khớp số thực tế, bán vàng (FIFO), mua lô, gửi/tất toán tiền gửi, thu/chi tiền mặt, chứng khoán, lịch sử giao dịch |
| | Hiệu quả | Diễn biến giá trị danh mục; kiểm định quá khứ: nếu đã tái cơ cấu theo phân bổ chiến lược từ 1/6/12 tháng trước, chia theo từng lớp tài sản |
| **Thị trường** | Tin tức | Tin kinh tế CafeF, Vietstock, VnEconomy (RSS), chủ đề nóng 7 ngày |
| | Vĩ mô & dòng tiền | Nhận định quý, chu kỳ kinh tế, kinh tế VN, dòng tiền liên thị trường, ngành được tập trung đầu tư, rủi ro suy thoái, lạm phát & sức mua |
| | Vàng Việt Nam | Premium so với thế giới, chênh lệch mua–bán, cung cầu, độ ổn định, mốc xác nhận đáy sau đỉnh, bảng yếu tố kỳ vọng, bối cảnh chính sách |
| **Chiến lược** | Phân bổ chiến lược | Giả định kỳ vọng thị trường (CME); so sánh hiện trạng với phân bổ tối ưu theo khẩu vị rủi ro (Cân bằng / Tăng trưởng mạnh) |
| | Dự phóng | Monte Carlo 2.000 kịch bản (1/3/5/10 năm): danh mục mục tiêu so với hiện trạng, kịch bản xấu/tốt, sụt giảm tối đa, thu nhập thụ động, điểm hòa giá vàng |
| | Điều chỉnh chiến thuật | Nút **Phân tích lại toàn bộ**: tải dữ liệu mới, chấm điểm tín hiệu vàng, vĩ mô, lãi suất, dòng tiền cho từng lớp tài sản, đề xuất nghiêng tỷ trọng ±5 điểm % quanh SAA (TAA), so sánh trước–sau; bấm Áp dụng mới đổi mục tiêu. Nút **Xuất cho run.py** |
| **Thực thi** | Việc cần làm | Việc cần làm trong ngày; khối thu gọn Giảm tỷ trọng vàng (số lượng giữ lại, lịch bán theo tháng; mỗi đợt tăng/giảm/tạm dừng theo premium SJC và giá vàng thế giới); rà soát danh mục (tính trên trình duyệt) |
| | Giải ngân | Số tiền và số chứng chỉ quỹ ETF mua mỗi tháng (DCA), quỹ mở, cổ phiếu đáng quan tâm kèm chỉ số tài chính và cảnh báo rủi ro |
| **Tài khoản** | | Người dùng, đồng bộ giữa các thiết bị, xuất/nhập sao lưu JSON; giới thiệu |

## Phương pháp phân bổ (CFA Level III)

1. **Kỳ vọng thị trường (CME)** cho từng lớp tài sản, tính lại khi dữ liệu thay đổi:
   - *Tiết kiệm:* lãi hiện tại cho năm đầu, lãi dài hạn cho các năm sau.
   - *Trái phiếu:* trung vị lợi nhuận 12 tháng của các quỹ trái phiếu (≈ lợi suất hiện tại).
   - *Cổ phiếu:* Grinold–Kroner (cổ tức + tăng trưởng thực + lạm phát − pha loãng), điều chỉnh theo xu hướng VN-Index (MA200) và mức rủi ro suy thoái.
   - *Vàng:* kỳ vọng vàng thế giới trừ phần premium SJC dự kiến co lại, cộng thêm khi lạm phát cao.
   - *Vệ tinh:* Cân bằng = tự giao dịch, alpha = 0, biến động cao hơn; Tăng trưởng mạnh = quỹ cổ phiếu tăng trưởng (kỳ vọng cổ phiếu + alpha sau phí).
2. **Tối ưu trung bình–phương sai (SAA):** tối đa U = E(R) − ½·λ·σ², khẩu vị **Cân bằng (λ = 4)** hoặc **Tăng trưởng mạnh (λ = 1**, không quỹ khẩn cấp, cổ phiếu ≤ 80%, vệ tinh ≤ 30%), dưới các ràng buộc IPS: quỹ khẩn cấp, vàng tối thiểu/tối đa, trần cổ phiếu và vệ tinh.
3. **Điều chỉnh chiến thuật (TAA, tùy chọn):** chấm điểm tín hiệu thị trường từng lớp, nghiêng tối đa ±5 điểm % quanh SAA, tổng nghiêng bằng 0, giữ ràng buộc IPS; chỉ áp dụng khi người dùng bấm Áp dụng.

Mọi giả định và ràng buộc chỉnh được ở *Chiến lược › Giả định CME*. Logic: `plan.js` (`cme()`, `optimize()`, `simulate()`), `taa.js` (`taaSignals()`, `applyTilt()`).

## Tệp

```
index.html    Giao diện 5 tab (+ Chart.js)
app.js        Trạng thái, giao dịch, lộ trình bán vàng, biểu đồ, đăng nhập/lưu trữ (Supabase bảng portfolios hoặc localStorage quyvang_v1)
plan.js       CME, tối ưu danh mục, thẻ hồ sơ, Monte Carlo, kiểm định quá khứ, rà soát danh mục
taa.js        Điều chỉnh chiến thuật: tín hiệu, mức nghiêng, áp dụng vào mục tiêu, xuất webapp_plan.json cho run.py
macro.js      Thị trường: vĩ mô, dòng tiền, rủi ro suy thoái, lạm phát, tin tức, vàng Việt Nam
invest.js     Hướng dẫn giải ngân (ETF, quỹ mở, cổ phiếu)
tabs.js       Tab theo hash, mục con và khối thu gọn nhớ trạng thái
```

Dữ liệu thị trường đọc từ `../data/` (xem [README chính](../README.md#dữ-liệu-thị-trường)).

## Nguồn dữ liệu

| Dữ liệu | Nguồn | Cập nhật |
|---|---|---|
| Giá vàng SJC, nhẫn | PNJ (trình duyệt gọi trực tiếp khi mở trang) + lịch sử SJC | Thời gian thực / 4 lần/ngày |
| Vàng TG, USD/VND, chỉ số, hàng hóa, VIX | Yahoo Finance | 4 lần/ngày |
| Đường cong lợi suất, quy tắc Sahm, xác suất suy thoái, chênh lệch HY, CPI Mỹ | FRED | 4 lần/ngày |
| Lạm phát VN theo năm | World Bank | 4 lần/ngày |
| VN-Index, giá ETF và cổ phiếu, P/E, P/B, ROE… | VNDirect | 4 lần/ngày |
| Quỹ mở trái phiếu/cổ phiếu (NAV, hiệu suất, phí) | fmarket | 4 lần/ngày |
| CPI, GDP, tín dụng, đầu tư công, lãi tiết kiệm VN | Cục Thống kê, NHNN, Bộ Tài chính | Thủ công hằng tháng (`data/vn_macro.json`) |
| Nhận định vĩ mô, ngành, bối cảnh chính sách vàng | Viết tay có nguồn | Hằng tháng/quý (`data/vn_outlook.json`) |

Giá SJC trước ngày bắt đầu theo dõi là **ước tính** (giá thế giới quy đổi × premium lần đo đầu tiên) và được vẽ nét đứt.

## Đồng bộ với báo cáo `run.py`

Công cụ báo cáo Python (ngoài repo) dùng cùng mục tiêu với app: *Chiến lược › Điều chỉnh chiến thuật › Xuất cho run.py* tải `webapp_plan.json` (tỷ trọng SAA, mục tiêu đã gồm TAA, số vàng giữ lại, quy tắc bán vàng). Lưu file vào thư mục chứa `run.py`; xuất lại sau mỗi lần Áp dụng / Bỏ điều chỉnh.

## Bảo trì

- **Hằng tháng** (sau khi Cục Thống kê công bố, khoảng ngày 6): cập nhật `data/vn_macro.json`, ghi nguồn và kỳ số liệu, đổi `asOf`.
- **Hằng tháng/quý:** cập nhật `data/vn_outlook.json` (mỗi điểm có link nguồn).
- **Khi có sự kiện doanh nghiệp:** cập nhật `RISK_NOTES` trong `scripts/update_invest.py`, luôn ghi nguồn. Danh sách mã theo dõi ở `STOCKS` và `ETFS`.
- **Khi đổi phương pháp hoặc giả định mặc định** trong `plan.js`: tăng `PLAN_VERSION` để dữ liệu cũ của người dùng chuyển sang giả định mới.
- Không bao giờ commit dữ liệu tài sản cá nhân (số lượng, giá vốn, giao dịch) vào repo.
