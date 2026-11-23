# Heparin IV Calc.

<img src="../logo.svg" width="48" alt="">

Mục `heparin/` của [Trieu's Note](../README.md). Giao diện tiếng Anh, tính toàn bộ trên trình duyệt, không cần đăng nhập.

🔗 https://theodore-ng.github.io/trieus-note/heparin/

Tính liều heparin không phân đoạn truyền tĩnh mạch theo Dager 2018 (ASHP, Table 3-5):

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

**Khác bản gốc:** từ 2.5.2, Safety notes lấy ngưỡng ngưng truyền 1 giờ theo bảng (VTE > 120 giây, tim mạch > 90 giây) thay vì "> mức trên của đích" (lệch với bảng). **Cần rà lại:** bảng chỉnh liều tim mạch được bản gốc ghi là "adapted from standard protocol", không lấy trực tiếp từ Dager.

## Tệp

```
index.html          Giao diện: chọn chỉ định, cân nặng, dung dịch pha; liều khởi đầu, chỉnh liều theo aPTT, Copy Orders; bảng hướng dẫn và 12 tài liệu tham khảo
heparin.js          Logic và dữ liệu phác đồ (bản chuyển từ ../scripts/heparin/*.ts)
app.js              Luồng giao diện (theo App.tsx gốc)
../scripts/heparin/ Bản TypeScript gốc, parity.py so JS với TS
```
