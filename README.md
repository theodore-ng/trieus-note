# Trieu's Note

<img src="logo.svg" width="64" alt="">

Web app cá nhân gồm nhiều mục, mở từ một trang chủ dạng thẻ và dùng chung một tài khoản đăng nhập. HTML/CSS/JavaScript thuần, không cần build, chạy trên GitHub Pages.

🔗 **https://theodore-ng.github.io/trieus-note/**

## Các mục

| Mục | Đường dẫn | Nội dung | Ngôn ngữ |
|---|---|---|---|
| [**Notes**](notes/README.md) | `notes/` | Ghi chú Markdown: checklist, tag, ghim, Archive / Trash, tìm kiếm không dấu, Paste, **+ GitHub** (tóm tắt + review repo) | English |
| [**Finance**](finance/README.md) | `finance/` | Quản lý danh mục vàng, tiền mặt, tiết kiệm, chứng khoán; phân bổ tối ưu theo CFA (SAA), điều chỉnh chiến thuật (TAA), lộ trình giảm tỷ trọng vàng, dữ liệu thị trường VN và thế giới | Tiếng Việt |
| [**Procedure Catalog**](ky-thuat/README.md) | `ky-thuat/` | Tra cứu danh mục kỹ thuật tương đương (bộ mã QĐ 7603, giá TT39/TT13) và quy trình kỹ thuật khoa Phẫu thuật mạch máu, kèm giải thích theo văn bản | Tiếng Việt |
| [**PAD Classification**](pad/README.md) | `pad/` | Phân loại bệnh động mạch chi dưới: Fontaine, Rutherford, WIfI | English |
| [**Heparin IV Calc.**](heparin/README.md) | `heparin/` | Liều heparin IV theo cân nặng, chỉnh liều theo aPTT (Dager 2018) | English |

PAD Classification và Heparin IV Calc. là công cụ hỗ trợ quyết định lâm sàng, không thay thế đánh giá của bác sĩ. Finance là công cụ theo dõi và lập kế hoạch, không phải khuyến nghị đầu tư.

## Kiến trúc

```text
index.html, core.js     Trang chủ: đăng nhập dùng chung (Supabase Auth), lưới thẻ các mục
style.css               Giao diện chung: retro nền giấy, chỉ giao diện sáng, Newsreader + Be Vietnam Pro
config.js               URL + khóa publishable của Supabase (để trống = chế độ cục bộ)
logo.svg, favicon-32.png, apple-touch-icon.png
notes/  finance/  ky-thuat/  pad/  heparin/     Các mục (mỗi mục có README riêng)
data/                   Dữ liệu thị trường JSON (GitHub Actions cập nhật), các mục đọc bằng ../data/
scripts/                Cập nhật dữ liệu (update_*.py), build Danh mục kỹ thuật (ky_thuat/),
                        bản gốc + kiểm tra khớp logic (pad/, heparin/), bản thử để kiểm thử (dev/harness.py)
supabase/schema.sql     Bảng portfolios, profiles, notes + Row Level Security
.github/workflows/prices.yml   Cập nhật dữ liệu 4 lần/ngày (9:15, 11:15, 14:15, 17:15 giờ VN) và commit vào data/
CHANGELOG.md            Nhật ký phiên bản
```

Mọi mục dùng chung logo ở góc trên trái (bấm để về trang chủ), `style.css` và phiên đăng nhập (Supabase lưu phiên theo origin nên đăng nhập một lần cho mọi mục).

## Dữ liệu và quyền riêng tư

- Repo **không chứa dữ liệu cá nhân**. Dữ liệu người dùng nằm trên Supabase (bảng `portfolios` cho Finance, `notes` cho Notes; Row Level Security: mỗi người chỉ đọc/ghi dòng của mình) hoặc trong `localStorage` của trình duyệt ở chế độ cục bộ.
- `config.js` chỉ chứa khóa **publishable/anon** (được phép công khai). **Không bao giờ** đặt khóa `service_role`/secret vào repo.
- Tự đăng ký đã tắt: tài khoản do quản trị viên tạo. Vai trò (`admin`/`user`) ở bảng `profiles`, không tự sửa được qua API.
- Procedure Catalog, PAD, Heparin tính toàn bộ trên trình duyệt, không gửi dữ liệu đi đâu.

## Dữ liệu thị trường

`data/` do `.github/workflows/prices.yml` cập nhật tự động: `prices.json` (giá vàng SJC/nhẫn, vàng thế giới, USD/VND), `macro.json` (Yahoo Finance, FRED, World Bank), `invest.json` (VNDirect, fmarket), `news.json` + `news_archive/` (RSS CafeF, Vietstock, VnEconomy). Cập nhật thủ công: `vn_macro.json` (hằng tháng), `vn_outlook.json` (hằng tháng/quý). Chi tiết nguồn ở [README Finance](finance/README.md#nguồn-dữ-liệu).

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
4. **SQL Editor**: chạy toàn bộ `supabase/schema.sql` (chạy lại nhiều lần không sao), rồi câu lệnh gán quyền admin ở cuối file (bỏ chú thích, thay `<ten>`).
5. Điền **Project URL** và **Publishable key** vào `config.js`.

### Cập nhật dữ liệu bằng tay

```bash
pip install -r scripts/requirements.txt
python scripts/update_prices.py && python scripts/update_invest.py && python scripts/update_news.py
```

## Phát hành và kiểm thử

- **Phiên bản** (semver, xem `CHANGELOG.md`): tham số `?v=` của css/js trong **mọi** `index.html` là số phiên bản, hiện ở chân trang chủ. Mỗi lần deploy phải tăng (GitHub Pages cache 10 phút). Sửa nhỏ → patch, mục/tính năng mới → minor, đổi cấu trúc hoặc mô hình dữ liệu → major. Mỗi bản: tag `vX.Y.Z` + GitHub release.
- **Kiểm thử:** `scripts/dev/harness.py <thư mục tạm>` dựng bản thử với dữ liệu mẫu ở chế độ cục bộ (hướng dẫn ở đầu file), rồi mở bằng trình duyệt headless để đọc lỗi JS và chụp màn hình (khổ 1100px và 520px).
- **Logic chuyển từ bản gốc:** PAD (`scripts/pad/`: 47 test pytest + `parity.py` so JS với Python) và Heparin (`scripts/heparin/parity.py` so JS với TypeScript gốc) phải "OK" sau mỗi lần sửa logic.
- **Danh mục kỹ thuật:** `ky-thuat/index.html` sinh từ `scripts/ky_thuat/`, không sửa tay (xem [README](ky-thuat/README.md#cập-nhật-dữ-liệu)).
