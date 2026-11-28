# Nhật ký thay đổi

Phiên bản theo semver: sửa lỗi và điều chỉnh nhỏ → patch, cập nhật lớn → minor, đổi cấu trúc tab hoặc mô hình dữ liệu → major. Số phiên bản là tham số `?v=` trong các file `index.html`.

## 2.12.1 – 28/11/2026

- Bỏ tên tài khoản khỏi chú thích trong `config.js` (thay bằng ví dụ chung).

## 2.12.0 – 28/11/2026

- Tóm tắt bệnh án: **đồng bộ ca bệnh qua Supabase** khi đã đăng nhập Trieu's Note (bảng `ttba_cases`, mỗi người chỉ đọc/ghi được ca của mình nhờ RLS).
  - Máy vẫn giữ một bản trong localStorage, nên ghi và sửa được khi mất mạng; có mạng lại thì tự đồng bộ, và đồng bộ lại khi mở lại app.
  - Ca sửa sau cùng được giữ; ca xóa ở máy này cũng bị xóa ở máy khác.
  - Khóa API Claude và cài đặt chỉ lưu trên từng máy, không lên Supabase. Ca mẫu không được đồng bộ.
  - Tự xóa ca sau N ngày áp dụng cho cả Supabase.
  - Chưa đăng nhập thì app chạy như trước (chỉ trên máy).
  - Cần chạy phần SQL `ttba_cases` mới trong `supabase/schema.sql` một lần.
- Nút **Xóa ca** cho từng ca (trước chỉ có Xóa tất cả).

## 2.11.1 – 28/11/2026

- Tóm tắt bệnh án: nút **Xem ca mẫu (bệnh nhân giả)** ở danh sách ca. Nút tạo sẵn một ca giả (nam 68 tuổi, CLTI chân phải, đặt stent động mạch đùi nông) gồm 7 đoạn ghi và bản đã sắp xếp: có mục trống, chỗ cần kiểm tra, thuật ngữ đã chuẩn hóa. Dùng để xem cấu trúc giao diện mà không cần khóa API, không gọi Claude. Có thể xóa như ca thường.

## 2.11.0 – 28/11/2026

- Mục mới **Tóm tắt bệnh án** (`ttba/`, tiếng Việt, làm cho iPhone):
  - **Ghi**: đọc từng đoạn bằng nhận dạng giọng nói tiếng Việt của Safari (hoặc gõ / micro bàn phím), chọn chủ đề cho đoạn (Bệnh sử, Tiền sử, Khám, Mạch máu, CLS…), nút ghi lớn ở vùng ngón cái, giữ màn hình sáng khi ghi.
  - **Sắp xếp**: Claude (mặc định Opus 5.5, khóa API người dùng dán, chỉ lưu trên máy) chuẩn hóa thuật ngữ theo từ điển cá nhân và xếp vào mẫu chung 13 mục (có mục Chỉ số mạch máu), trả JSON theo schema; đánh dấu chỗ cần kiểm tra (số liệu, liều, ICD-10 gợi ý).
  - **Duyệt**: mục trống nền vàng, nói thẳng vào từng mục, ghi thêm đoạn rồi sắp xếp bổ sung (giữ phần đã sửa); ước tính chi phí mỗi lần.
  - **Xuất**: chép toàn bộ để dán vào phần mềm bệnh viện, tải Word (.doc), chia sẻ qua iOS.
  - Dữ liệu chỉ lưu trên máy, tự xóa ca sau 30 ngày (đổi được); nhắc và quét thông tin định danh trước khi gửi.
- Trang chủ: thẻ **Case Summary**; cập nhật mô tả thẻ Procedure Catalog (bộ mã 7603, giá TT39/TT13, quy trình Bộ Y tế 2025).

## 2.10.0 – 27/11/2026

- Procedure Catalog: **quy trình Bộ Y tế 2025 là bản chính.** Lấy từ *Hướng dẫn quy trình kỹ thuật về Tuần hoàn* Tập 1.1 (QĐ 3675/QĐ-BYT) và Tập 2.1 (QĐ 3676/QĐ-BYT):
  - 11 quy trình Chợ Rẫy có bản Bộ Y tế tương đương (stent eo ĐMC, stent graft, stent ĐM thận, nong/stent ĐM chi, ABI, laser, sóng RF, lưới lọc TM chủ, nong TM ngoại biên): hiện bản Bộ Y tế, bản Chợ Rẫy thành tab **"BV Chợ Rẫy (bổ sung)"**.
  - 2 quy trình chỉ có bản Bộ Y tế liên quan (stent ĐM cảnh, tiêu sợi huyết tại chỗ): giữ Chợ Rẫy, thêm tab "Bộ Y tế (liên quan)".
  - Thêm 21 quy trình mạch máu chỉ có ở Bộ Y tế (chụp ĐMC/ĐM chi, stent mạch ngoại vi, dù bảo vệ, triệt đốt giao cảm ĐM thận, can thiệp đường vào chạy thận, các kỹ thuật hỗ trợ stent graft, phá mảng vôi bằng sóng xung kích, keo sinh học, siêu âm Doppler mạch, PWV, TBI, PPG, thông số huyết động TM, bơm hơi dẫn lưu phù bạch huyết).
  - 28 quy trình chưa có bản Bộ Y tế đọc được (phẫu thuật, điện quang can thiệp) vẫn dùng bản Chợ Rẫy.
- Danh sách quy trình (62 mục) có nhãn nguồn; trang đọc có dòng nguồn kèm link PDF; Văn bản tham chiếu thêm mục QĐ 3675/3676.

## 2.9.5 – 27/11/2026

- Procedure Catalog: giá hiện hành ghi theo **TP Đà Nẵng** (cơ sở công lập thuộc thành phố, vd BV Đà Nẵng: NQ 96/2026/NQ-HĐND ngày 31/7/2026; trước đó NQ 68/2024, NQ 22/2024), bệnh viện thuộc Bộ (vd Chợ Rẫy) chỉ còn là ví dụ phụ. 41 quy trình PT mạch máu ghi rõ là tài liệu tham khảo chuyên môn của BV Chợ Rẫy.

## 2.9.4 – 27/11/2026

- Procedure Catalog: cột QĐ phê duyệt (QĐ 466, 24, 130, 423, 1035, 1410, 473) ghi rõ là quyết định của Sở Y tế Đà Nẵng (tab Mã & QĐ và Văn bản tham chiếu).

## 2.9.3 – 27/11/2026

- Procedure Catalog: ghi rõ **giá hiện hành theo từng bệnh viện** (từ 2025 không còn bảng giá BHYT chung; theo TT21/2024 Bộ Y tế ra quyết định giá riêng cho bệnh viện trực thuộc). Ví dụ BV Chợ Rẫy: QĐ 3222/QĐ-BYT (01/11/2024), rồi QĐ 3024/QĐ-BYT (thanh toán từ 01/10/2026). Cập nhật ở phần Giải thích của từng kỹ thuật và Văn bản tham chiếu (mục TT15/2018), có link nguồn.

## 2.9.2 – 27/11/2026

- Procedure Catalog: dòng thống kê ở trang đầu chỉ còn tổng số kỹ thuật và số chuyên khoa.

## 2.9.1 – 27/11/2026

- Procedure Catalog: bỏ câu giới thiệu và hàng gợi ý tìm nhanh ("Thử: …") ở trang đầu cho gọn; còn dòng thống kê và phần Tham khảo.

## 2.9.0 – 27/11/2026

- Procedure Catalog **làm lại giao diện**, tra cứu là phần chính:
  - Đầu trang gọn: tên ngắn "Danh mục kỹ thuật"; chỉ ô tìm kiếm + bộ lọc dính trên cùng (trước cả khối cao 168px); điện thoại: bộ lọc một hàng cuộn ngang.
  - Bộ lọc mới **Chuyên khoa** (28 chương, xếp theo số La Mã), dùng cùng Tất cả / Phẫu thuật / Thủ thuật.
  - Trang đầu: lời dẫn, gợi ý tìm nhanh (catheter, stent, suy tĩnh mạch…), thống kê một dòng; **Tham khảo** ở dưới gồm Quy trình kỹ thuật khoa và Văn bản tham chiếu (văn bản chuyển sang trang đọc riêng `#van-ban`).
  - Thẻ kết quả: tab to hơn (cao 40px), chữ thường; tên tab "Mã & QĐ"; chuyên khoa viết thường; nhãn xuống dòng dưới tên khi hẹp; điện thoại mờ mép phải thanh tab khi còn tab bị khuất.
  - Trang đọc quy trình có mục lục nhảy tới từng phần (Đại cương, Chỉ định, … Các bước tiến hành).
  - Trợ năng: tab theo chuẩn ARIA (aria-controls, tabpanel, phím mũi tên / Home / End); phím `/` để nhảy vào ô tìm; nút "Chép mã" trả lại đúng chữ sau khi chép.

## 2.8.2 – 27/11/2026

- Procedure Catalog: bố cục tab dễ đọc hơn.
  - **Giá**: hai giá chính hiện to (Có BHYT · TT13, Không BHYT · TT37/2018); ghi chú thanh toán chia mục có vạch màu (điều kiện / tính riêng / đã gồm); giá cũ (TT39, TT15, TTLT 37/2015) gom thành một dòng "để đối chiếu".
  - **Mã & quyết định**: nhóm Mã (3 ô mã, nút Chép mã) · Quyết định · Phân nhóm & số thứ tự (gộp STT thành một dòng); nhãn chữ thường thay chữ in hoa.
  - **Ghi chú**: gộp các ghi chú trùng nhau giữa TT13, TT39, TT15, TT37/2018, mỗi ghi chú có thẻ văn bản nguồn.

## 2.8.1 – 27/11/2026

- Procedure Catalog: **phạm vi BHYT chi trả** trên từng kỹ thuật. Nhãn trên thẻ: **BHYT** (có giá BHYT TT13) hoặc **BHYT có điều kiện** (64 kỹ thuật có ghi chú "không thanh toán…", "chỉ áp dụng với người bệnh ngoại trú"…). Đầu tab Giá có khối BHYT tách ghi chú TT13 (thiếu thì lấy TT39) thành: điều kiện thanh toán / cách tính; **chưa gồm trong giá, tính riêng** (thuốc, vật tư… BHYT trả nếu thuộc danh mục quỹ thanh toán); đã gồm trong giá.
- Cả 9.190 kỹ thuật trong file đều có giá BHYT; "chưa bao gồm" nghĩa là khoản đó tính riêng, không phải BHYT không trả.

## 2.8.0 – 27/11/2026

- Procedure Catalog chuyển sang **danh mục tương đương mới** (bộ mã QĐ 7603/QĐ-BYT, giá TT39/2018 sửa bởi TT13/2019): 9.190 kỹ thuật (trước 8.924), không còn dòng "đã hủy".
  - Tab **Giá**: tên trong danh mục giá; giá TT13 (BHYT 2019), TT39, TT15 (2018), TTLT 37/2015 có lương, TT37/2018 (không BHYT). Bỏ giá TT02/2017.
  - Tab **Mã & quyết định**: QĐ phê duyệt (QĐ 466, 24, 130, 423, 1035, 1410, 473), chuyên khoa TT39, QĐ tương đương cũ, STT TT39/TT15/TT37. Tab **Ghi chú**: TT13, PL4 TT13, TT39, PL4 TT39/lý do sửa đổi, TT15, TT37/2018.
  - **Giải thích** và **Văn bản tham chiếu**: thêm QĐ 7603, TT39/2018 + TT13/2019, TTLT 37/2015; bỏ mục TT02.
- **Sửa lỗi ghi nhãn**: từ 2.1.1 hai cột "TT37 có lương / không lương" được ghi là TT37/2018; thực ra là hai mức giá BHYT của TTLT 37/2015. TT37/2018 (khung giá không BHYT) nay là cột riêng.
- `build.py` đọc cột theo tên tiêu đề thay vì vị trí.

## 2.7.1 – 27/11/2026

- Procedure Catalog: thẻ kết quả có **thanh tab nhỏ** thay cho nút "Chi tiết" (cảm hứng từ trang Pokédex): **Giá** (tương đương TT15, giá TT15 / TT37 có lương / TT37 không lương / TT02) · **Mã & quyết định** · **Ghi chú** (chỉ khi có) · **Giải thích** (theo văn bản) · **Quy trình** (chỉ khi có quy trình của khoa). Mặc định thu gọn; bấm tab để mở, bấm lại để đóng.

## 2.7.0 – 23/11/2026

- **Notes** (mục Ghi chú) và **trang chủ** chuyển sang tiếng Anh (nút, thư mục Notes / Archive / Trash, thông báo, ngày giờ, thẻ các mục). Quản lý tài chính, Danh mục kỹ thuật giữ tiếng Việt.
- **+ GitHub**: dán link repo GitHub → ghi chú gồm Info (tác giả, ngôn ngữ, giấy phép, sao/fork, issue, bản phát hành, ngày), Summary (mô tả + đoạn mở đầu README, các mục README) và Review theo quy tắc (phổ biến, độ hoạt động, giấy phép, tài liệu, phát hành → Worth trying / Usable, check further / Use with caution), cuối có mục "My notes". Dán lại cùng repo thì cập nhật số liệu, giữ nguyên "My notes". Lấy dữ liệu công khai qua GitHub API (60 lần/giờ), không dùng AI.
- **Empty Trash**: nút xóa vĩnh viễn mọi ghi chú trong thùng rác (hỏi xác nhận).
- Bỏ nút **Nhập file** (nhập .md / sao lưu .json) cho gọn; còn nút Paste và Export backup.

## 2.6.2 – 23/11/2026

- Ghi chú: thêm cách lấy ghi chú từ iPhone không cần phím tắt:
  - Nút **Nhập file** nhận file **Markdown (.md)**, chọn được nhiều file một lần (vd Notes › Export as Markdown): mỗi file một ghi chú, dòng đầu thành tiêu đề, ngày theo file, nhãn #iPhone; nhập lại không trùng. Vẫn nhận file sao lưu .json.
  - Nút **Dán** cạnh Mới: tạo ghi chú từ chữ vừa sao chép (vd chọn hết chữ trong Notes › Copy).
- Bỏ khối hướng dẫn tạo phím tắt trong trang (phức tạp). Địa chỉ `#import&body=…` cho phím tắt vẫn hoạt động.

## 2.6.1 – 23/11/2026

- Ghi chú: hướng dẫn tạo phím tắt lấy ghi chú từ iPhone chuyển sang tiếng Anh, dùng đúng tên tác vụ của iOS tiếng Anh (Show in Share Sheet, Make Markdown from Rich Text, URL Encode, Text, Open URLs, Send a Copy); phím tắt đổi tên thành "Send to Trieu's Note".

## 2.6.0 – 23/11/2026

- Ghi chú: **lấy ghi chú từ app Ghi chú (Notes) trên iPhone**. Phím tắt "Gửi tới Trieu's Note" (hướng dẫn tạo ngay trong trang Ghi chú) gửi ghi chú đang mở qua Bảng chia sẻ: chuyển sang Markdown, mở `…/notes/#import&body=…` (nội dung nằm sau dấu #, không gửi lên máy chủ); app hỏi xác nhận, dòng đầu thành tiêu đề, gắn nhãn #iPhone; gửi lại cùng ghi chú không bị trùng. Chưa đăng nhập thì giữ ghi chú chờ, đăng nhập xong nhận tiếp.
- Nhập sao lưu nhận thêm file xuất hàng loạt từ phím tắt iPhone (`{title, body, created, modified, folder}`, mảng JSON hoặc nhiều đối tượng nối tiếp; file .json/.txt), gắn nhãn #iPhone + tên thư mục, mã cố định theo tiêu đề + ngày tạo nên nhập lại không trùng.

## 2.5.3 – 23/11/2026

- Điều chỉnh chiến thuật: nút **Xuất cho run.py** tải `webapp_plan.json` (tỷ trọng SAA, mục tiêu đã gồm TAA đang áp dụng, mức nghiêng thực tế sau ràng buộc, số vàng giữ lại, quy tắc bán vàng). Lưu file vào thư mục dự án (ngoài repo) để báo cáo `run.py` dùng cùng mục tiêu và lịch bán với web app.

## 2.5.2 – 23/11/2026

- Heparin › Safety notes: ngưỡng ngưng truyền 1 giờ lấy theo bảng chỉnh liều của chỉ định đang chọn (VTE: aPTT > 120 giây; STEMI/NSTEMI: > 90 giây). Bản gốc ghi "> mức trên của đích" (> 100 / > 70 giây), lệch với bảng.

## 2.5.1 – 23/11/2026

- Quản lý tài chính › Thực thi: gộp mục con "Giảm tỷ trọng vàng" vào **Việc cần làm** thành khối thu gọn (dòng tiêu đề tóm tắt "Đã bán x/y lượng · tháng này: …", mở ra là tiến độ, lịch bán, chỉnh quy tắc); tab Thực thi còn Việc cần làm · Giải ngân.

## 2.5.0 – 23/11/2026

- Mục mới **Heparin IV Calc.** (`heparin/`): liều heparin truyền tĩnh mạch theo cân nặng và chỉnh liều theo aPTT cho VTE, STEMI (rt-PA liều đầy đủ / phối hợp), NSTEMI/UA; PCI (theo dõi ACT) chỉ hiện khoảng liều bolus. Dung dịch pha tùy chọn (IU trong túi + mL dung môi), giới hạn liều tối đa, ngưng truyền 1 giờ khi aPTT quá cao, nút Copy Orders, bảng hướng dẫn và 12 tài liệu tham khảo (Dager 2018, ASHP). Chuyển từ repo riêng `heparin-web-app` (React/TypeScript) sang JavaScript, giao diện tiếng Anh theo theme Trieu's Note; logic khớp 100% bản TypeScript gốc (14.644 ca kiểm, `scripts/heparin/parity.py`).

## 2.4.0 – 23/11/2026

- Quản lý tài chính › Chiến lược: mục mới **Điều chỉnh chiến thuật (TAA)** với nút **Phân tích lại toàn bộ** (tải lại giá vàng, vĩ mô, lãi suất, dòng tiền, quỹ rồi tính lại mọi phân tích). Chấm điểm tín hiệu từng lớp tài sản: vàng (bảng yếu tố vàng VN + trạng thái đáy sau đỉnh), cổ phiếu lõi (dòng tiền, pha chu kỳ, phần bù rủi ro so với tiết kiệm), quỹ trái phiếu (lợi nhuận so với tiết kiệm, lợi suất Mỹ, pha chu kỳ), tiền mặt + tiết kiệm (lãi suất thực, rủi ro suy thoái, đình lạm) → đề xuất nghiêng tối đa ±5 điểm % quanh SAA, tổng nghiêng bằng 0, giữ ràng buộc IPS; so sánh lợi nhuận kỳ vọng và độ biến động trước–sau, số tiền cần chuyển mỗi tháng. Bấm **Áp dụng** mới đổi mục tiêu (lưu mức nghiêng, SAA vẫn tự cập nhật theo CME); **Bỏ điều chỉnh** để về SAA; nhắc phân tích lại sau 90 ngày hoặc khi tín hiệu đổi.

## 2.3.0 – 23/11/2026

- **Ghi chú** thành app ghi chú đầy đủ: thư mục Ghi chú / Lưu trữ / Thùng rác (kèm số lượng; thùng rác tự xóa hẳn sau 30 ngày, khôi phục hoặc xóa vĩnh viễn được), nhãn (gắn nhiều nhãn, lọc theo nhãn, gợi ý nhãn đã có), Markdown với chế độ Viết / Xem (tiêu đề, đậm, danh sách, bảng, link mở tab mới; HTML được lọc an toàn bằng DOMPurify), checklist `- [ ]` tick được ngay trong chế độ Xem, nhập sao lưu (chỉ thêm ghi chú chưa có).
- Supabase: bảng `notes` thêm cột `archived`, `deleted_at`, `tags`; SQL trong `supabase/schema.sql` chạy được cả khi chưa có bảng lẫn khi đã có.

## 2.2.0 – 23/11/2026

- Mục mới **PAD Classification** (`pad/`): phân loại bệnh động mạch chi dưới theo Fontaine, Rutherford, WIfI; chuyển từ repo riêng `pad-classification` (PyScript) sang JavaScript nên mở tức thì, giao diện tiếng Anh theo theme Trieu's Note, kết quả cập nhật ngay khi nhập. Logic khớp 100% bản Python gốc (24.487 ca kiểm, `scripts/pad/parity.py`); bản Python và 47 test gốc giữ ở `scripts/pad/`.

## 2.1.1 – 20/11/2026

- Mọi mục dùng chung logo Trieu's Note ở góc trên trái; bấm vào là về trang chủ (thay biểu tượng ô lưới).
- Danh mục kỹ thuật: bộ lọc chỉ còn Tất cả / Phẫu thuật / Thủ thuật (bỏ chọn chương, tuyến A–D, "Có quy trình KT"); thẻ kết quả chỉ hiện tên, mã, lĩnh vực, tuyến, phân độ; tên tương đương TT15, giá, nút xem quy trình và các thông tin khác nằm trong "Chi tiết".
- Danh mục kỹ thuật › Văn bản tham chiếu: mỗi văn bản có "Chi tiết" tóm tắt nội dung chính, ngày ký/hiệu lực, hiệu lực hiện nay (kiểm tra 20/11/2026: QĐ 4442/4883 đã bị QĐ 7435 thay thế; TT43/2013, TT21/2017 hết hiệu lực từ 18/10/2024; TT15/2018, TT02/2017 đã được thay thế) và link nguồn. Văn bản bị thay thế có thêm khối "Văn bản thay thế, sửa đổi": QĐ 7435; TT23/2024 và Thông tư sửa đổi năm 2026 (Phụ lục 01 dùng đến hết 31/12/2027, Phụ lục 02 từ 01/01/2028, mã theo chương TT43/TT21 vẫn là mã kỹ thuật, giữ phân loại TT50); TT39/2018 → TT22/2023 → TT21/2024 (giá BHYT); TT14/2019 → TT21/2023 → TT21/2024 (khung giá không BHYT). TT43 có tóm tắt 4 tuyến và nguyên tắc phân tuyến theo nguyên văn.
- Danh mục kỹ thuật › Chi tiết từng kỹ thuật: mục "Giải thích theo văn bản" cho chính dòng đó: ý nghĩa tuyến (TT43), phân loại và định mức nhân lực tối đa mỗi ca theo chuyên khoa (TT50 Phụ lục 1), giá nào áp dụng khi có/không có BHYT, tỷ lệ thanh toán khi làm kèm.
- README: thêm phần Danh mục kỹ thuật (tính năng, bảng hiệu lực dữ liệu, điểm chưa làm rõ).
- Còn chưa làm rõ: bảng giá BHYT hiện hành sau 01/01/2025; số hiệu Thông tư sửa đổi 2026; nguyên văn TT21/2023; văn bản thay thế QĐ 7435; quy tắc áp dụng cột TT37 có/không lương; một số ô định mức nhân lực TT50 (chi tiết trong README).

## 2.1.0 – 20/11/2026

- Mục mới **Danh mục kỹ thuật** (`ky-thuat/`): tra cứu danh mục kỹ thuật tương đương (QĐ 4442, 4883) và quy trình kỹ thuật khoa Phẫu thuật mạch máu, chuyển từ repo riêng `danh-muc-ky-thuat` vào Trieu's Note; đổi sang theme chung (nền giấy, chỉ giao diện sáng, tiêu đề Newsreader), có nút về trang chủ. Công cụ build ở `scripts/ky_thuat/`.

## 2.0.0 – 20/11/2026

- Đổi thành **Trieu's Note**: trang chủ dạng thẻ chứa các mục con, một tài khoản đăng nhập dùng chung. Repo đổi tên `gold-portfolio` → `trieus-note`.
- **Quản lý tài chính** chuyển vào `finance/` (giữ nguyên 5 tab và dữ liệu; nút về trang chủ cạnh tiêu đề).
- Mục mới **Ghi chú** (`notes/`): tạo, sửa tự lưu, tìm kiếm không dấu, ghim, xóa, xuất sao lưu; lưu Supabase (bảng `notes`) hoặc trong trình duyệt.

## 1.0.8 – 13/11/2026

- Tổng quan, ô NAV: dòng "Do:" tách thay đổi so với phiên trước theo nguyên nhân: vàng (giá mua SJC × số lượng giữ), lãi tiết kiệm, giao dịch & khác (bán/mua, nạp/rút trong ngày).
- Thị trường: nút "Cập nhật & phân tích lại" tải lại dữ liệu mới nhất (máy chủ cập nhật 4 lần/ngày, giá SJC trực tiếp) và tính lại mọi phân tích, kèm thời điểm của dữ liệu.

## 1.0.7 – 11/11/2026

- Cơ cấu tài sản: thêm biểu đồ tròn Mục tiêu (theo khẩu vị đang chọn) cạnh biểu đồ Hiện tại, cùng bảng màu; rê chuột hiện tỷ trọng %; giãn khoảng cách hai biểu đồ, bỏ dòng "Mục tiêu theo khẩu vị…" (đã có trong nhãn biểu đồ).
- Diễn biến giá trị danh mục: trục giá trị bắt đầu từ 0 để lớp dưới cùng (vàng) không bị cắt khỏi biểu đồ khi cơ cấu thay đổi.
- Sửa: trên Safari iPhone, cột Chi tiết trong Lịch sử giao dịch (và các ô có đoạn chữ dài) bị phóng to chữ do tính năng tự điều chỉnh cỡ chữ của Safari; tắt bằng `text-size-adjust: 100%`.

## 1.0.6 – 10/11/2026

- Tổng quan làm lại: 4 ô chỉ số (NAV kèm biểu đồ nhỏ 3M, Tăng trưởng tổng tài sản, Thu nhập thụ động ước tính hiện tại và khi đạt mục tiêu, Tiến độ giảm tỷ trọng vàng có thanh tiến độ và link lịch bán). Thẻ Cơ cấu tài sản so sánh hiện tại với mục tiêu của khẩu vị đang chọn, cột Lệch (điểm %) có thanh xanh/đỏ; trên điện thoại bảng xuống dưới biểu đồ, ẩn thanh lệch.

## 1.0.5 – 10/11/2026

- Tổng quan: bỏ ô "Vàng nắm giữ" và "Giá SJC mua vào / bán ra" (giá đã lên thanh tiêu đề); dòng Vàng trong Cơ cấu tài sản ghi kèm số lượng. Ô Lãi/lỗ lũy kế thành **Tăng trưởng tổng tài sản** (%/năm, CAGR của NAV từ ngày mua lô vàng ban đầu đến nay, đã loại tiền nạp/rút từ bên ngoài; dưới 1 năm thì hiện mức tăng cộng dồn, không năm hóa). Việc cần làm nhắc nhập ngày mua cho lô vàng ban đầu nếu thiếu.
- Favicon: thêm số phiên bản vào đường dẫn (trình duyệt giữ favicon cũ rất lâu), bản PNG 32px dự phòng và apple-touch-icon PNG 180px cho màn hình chính điện thoại.
- Phân bổ chiến lược: còn 2 khẩu vị. Bỏ Thận trọng và Tăng trưởng (kết quả gần Cân bằng). Thêm **Tăng trưởng mạnh** (λ=1): không quỹ khẩn cấp, cổ phiếu ≤ 80%, vệ tinh ≤ 30% bằng quỹ cổ phiếu tăng trưởng (kỳ vọng = cổ phiếu + 2%, biến động 25%, chỉnh trong Giả định CME). Giải ngân có mục quỹ tăng trưởng (top 3 năm, mỗi công ty một quỹ); Việc cần làm gợi ý mua quỹ theo đợt DCA; loại quỹ có thêm "Tăng trưởng (vệ tinh)". Ai đang chọn Thận trọng/Tăng trưởng được chuyển về Cân bằng.
- Việc cần làm: gợi ý giải ngân cụ thể cho tiền nhàn rỗi (tiền mặt vượt quỹ khẩn cấp, vd sau khi bán vàng) theo phân bổ chiến lược: mua ETF cổ phiếu lõi đợt DCA tháng này (kèm số CCQ, trừ phần đã mua trong tháng) → quỹ trái phiếu → gửi tiết kiệm bậc thang 3–6–12 tháng (chia ngân hàng theo hạn mức bảo hiểm 125 tr) → phần còn lại giữ kỳ hạn ngắn chờ các đợt sau; cảnh báo khi quỹ khẩn cấp thiếu.
- Kiểm định quá khứ: bỏ dòng tóm tắt "Từ 1 năm trước…" trên tiêu đề thẻ; cột Chênh lệch đưa lên ngay sau mốc thời gian.

## 1.0.4 – 09/11/2026

- Thanh tiêu đề: bỏ đơn vị "tr/lượng" cạnh giá vàng (đơn vị hiện trong chú thích khi rê chuột).

## 1.0.3 – 09/11/2026

- Thanh tiêu đề: giá vàng SJC mua/bán hôm nay kèm ▲ xanh / ▼ đỏ / ■ đứng giá so với phiên trước (thay dòng nguồn giá; nguồn và giờ cập nhật hiện khi rê chuột).
- Diễn biến giá trị danh mục: dòng giá trị hôm nay và tăng/giảm so với phiên trước, cùng kiểu mũi tên; ô NAV ở Tổng quan dùng cùng kiểu.

## 1.0.2 – 09/11/2026

- Sửa: biểu đồ Diễn biến giá trị danh mục và Lạm phát & sức mua cắt theo số ngày lịch (trước đây cắt theo số điểm dữ liệu nên 1Y kéo dài khoảng 16 tháng). Nhãn trục hiện năm khi xem từ 1Y trở lên.
- Đơn vị thời gian theo chuẩn quốc tế: M (tháng), Y (năm) thay cho T/N (T dễ nhầm tuần/tháng).

## 1.0.1 – 09/11/2026

- Đổi tên app thành **Quản lý tài chính**.
- Logo mới: nhân vật tròn đỏ cam há miệng đớp đồng xu vàng (ảnh pixel 24×24, giữ bảng màu cũ).

## 1.0.0 – 09/11/2026 (bản ổn định đầu tiên)

- **Tên mới:** Quản trị Vốn (Capital Management), logo ảnh pixel tôm hùm cầm đồng xu (`logo.svg`).
- **Cấu trúc theo quy trình quản lý danh mục CFA** (lập kế hoạch → thực thi → theo dõi và đánh giá), 5 tab:
  - Danh mục: Tổng quan (NAV, lãi/lỗ lũy kế, cơ cấu tài sản) · Nắm giữ & giao dịch · Hiệu quả (diễn biến giá trị, kiểm định quá khứ).
  - Thị trường: Tin tức · Vĩ mô & dòng tiền · Vàng Việt Nam.
  - Chiến lược: Phân bổ chiến lược (giả định CME, SAA theo khẩu vị rủi ro) · Dự phóng Monte Carlo.
  - Thực thi: Việc cần làm + rà soát danh mục · Giảm tỷ trọng vàng · Giải ngân.
  - Tài khoản: Người dùng & sao lưu · Giới thiệu.
- **Thuật ngữ:** Hiện trạng / Mục tiêu (thay Giữ nguyên / Theo dự án), khẩu vị rủi ro (thay hồ sơ), kiểm định quá khứ, dự phóng, kế hoạch giảm tỷ trọng vàng, NAV.
- Link cũ (#info, #assets, #me, #about) tự chuyển sang tab mới. Dữ liệu (`quyvang_v1`) giữ nguyên.

## Trước 1.0.0 (07–09/11/2026)

Các bản đánh số theo ngày (`?v=2026110xx`): quản lý vàng/tiền mặt/tiết kiệm/chứng khoán, đăng nhập Supabase, lộ trình bán vàng, tối ưu CFA, Monte Carlo, vĩ mô & dòng tiền, tin tức RSS, giao diện retro nền sáng, phân tích vàng Việt Nam (premium, chênh lệch mua–bán, vùng đáy), các khối thu gọn.
