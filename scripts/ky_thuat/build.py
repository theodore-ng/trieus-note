"""Build trang Danh mục kỹ thuật từ file Excel danh mục tương đương (bản QĐ 7603, giá TT39/TT13; sheet đầu tiên).
Dùng: python build.py <file danh mục>.xlsx template.html page.html procs.json [byt.json]
byt.json (tùy chọn, từ byt2procs.py): quy trình Bộ Y tế, ưu tiên hiển thị; bản Chợ Rẫy thành tab bổ sung.
Đọc cột theo TÊN tiêu đề (dòng có ô "Mã tương đương"), không theo vị trí; bỏ dòng không có mã (dòng tổng cuối bảng).
Thứ tự trường mỗi dòng phải khớp const F trong template.html."""
import datetime, json, re, sys, unicodedata
import openpyxl

xlsx, tpl, out, procs_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
sys.stdout.reconfigure(encoding="utf-8")
wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
rows = list(wb.worksheets[0].iter_rows(values_only=True))

def norm(v):
    return re.sub(r"\s+", " ", str(v or "").replace("\xa0", " ")).strip().lower()

hi = next(i for i, r in enumerate(rows[:30]) if any(norm(c) == "mã tương đương" for c in r))
hdr = [norm(c) for c in rows[hi]]

def col(prefix, nth=0):
    """Chỉ số cột có tiêu đề bắt đầu bằng `prefix` (lần xuất hiện thứ nth)."""
    hits = [i for i, h in enumerate(hdr) if h.startswith(prefix)]
    if len(hits) <= nth:
        raise SystemExit(f"Thiếu cột '{prefix}' trong {xlsx}")
    return hits[nth]

C = {
    "stt": col("stt"), "ma": col("mã tương đương"), "ma43": col("mã tt43"), "ten": col("tên theo danh mục kỹ thuật"),
    "tuyen": col("phân tuyến"), "loai": col("phân loại"), "s39": col("stt tt39"),
    "ten39": col("tên theo danh mục giá"), "g39": col("giá tt39"), "gc39": col("ghi chú tt39"),
    "g13": col("giá tt13"), "gc13": col("ghi chú tt13"), "pl4_13": col("ghi chú phụ luc 4 tt13"), "pl4_39": col("ghi chú (phụ lục 4 tt39"),
    "chap": col("chuyên khoa theo tt43"), "s15": col("stt tt15"), "g15": col("giá tt15"), "gc15": col("ghi chú tt15"),
    "g37c": col("giá tt37 (có lương)"), "s37": col("stt tt37"), "g37": col("giá tt37/2018"), "gc37": col("ghi chú tt37/2018"),
    "ck": col("chuyên khoa tt39"), "bhyt": col("mã giá liên thông bhyt"), "tdg": col("thay đổi giá"), "tdgc": col("thay đổi ghi chú"),
    "qdcu": col("số qđ tương đương cũ"), "ngaycu": col("ngày ban hành", 0),
    "qd37": col("số qđ tương đương (cũ theo tt37)"), "ngay37": col("ngày ban hành", 1),
}
QD = [(i, str(rows[hi][i]).strip()) for i, h in enumerate(hdr) if h.startswith("qđ.")]  # cột đánh dấu QĐ phê duyệt

def s(v):
    if v is None:
        return ""
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = str(v).replace("\xa0", " ").strip()
    return re.sub(r" 00:00:00$", "", t)

def price(v):
    t = s(v)
    if re.fullmatch(r"\d[\d,.]*", t) and not re.fullmatch(r"\d+\.\d+", t):
        return int(re.sub(r"[,.]", "", t))
    return t  # giữ nguyên giá trị lỗi/bất thường như trong file

chaps, cks = [], []
def idx(lst, v):
    if v not in lst:
        lst.append(v)
    return lst.index(v)

data = []
for r in rows[hi + 1:]:
    if not s(r[C["ma"]]):
        continue
    g = lambda k: s(r[C[k]])
    qds = ", ".join(lbl.replace("QĐ.", "QĐ ") for i, lbl in QD if s(r[i]))
    data.append([
        g("stt"), idx(chaps, g("chap")), g("ma"), g("ma43"), g("ten"), g("tuyen"), g("loai"), qds,
        g("ten39"), price(r[C["g39"]]), g("gc39"), price(r[C["g13"]]), g("gc13"), g("pl4_13"), g("pl4_39"),
        g("s39"), g("s15"), price(r[C["g15"]]), g("gc15"), price(r[C["g37c"]]), g("s37"), price(r[C["g37"]]), g("gc37"),
        idx(cks, g("ck")), g("bhyt"), g("tdg"), g("tdgc"), g("qdcu"), g("ngaycu"), g("qd37"), g("ngay37"),
    ])

def key(t):
    t = unicodedata.normalize("NFD", t.replace("đ", "d").replace("Đ", "D").lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    t = re.sub(r"^phau thuat ", "", t)
    for a, b in [("cat bo ", "cat "), ("noi cac mach mau than kinh", "noi mach mau"), ("luoi loc mau", "luoi loc"), (" 5 10 cm", " 5 den 10 cm")]:
        t = t.replace(a, b)
    return t

procs = json.load(open(procs_path, encoding="utf-8"))
# Quy trình Bộ Y tế (byt2procs.py): gắn vào quy trình Chợ Rẫy tương ứng (cr) hoặc thêm mới
if len(sys.argv) > 5:
    for b in json.load(open(sys.argv[5], encoding="utf-8")):
        v = {k: b[k] for k in ("t", "h", "ref", "url")}
        if "cr" in b:
            procs[b["cr"] - 1]["byt"] = {**v, "rel": bool(b.get("rel"))}
        else:
            procs.append({**v, "src": "byt", "g": b.get("g", 1)})
rk = [key(r[4]) for r in data]
for pr in procs:
    k = key(pr["t"])
    pr["rows"] = [i for i, x in enumerate(rk) if x == k]
    print(len(pr["rows"]), pr["t"][:60], [data[i][2] for i in pr["rows"]])
payload = json.dumps({"chaps": chaps, "cks": cks, "rows": data, "procs": procs}, ensure_ascii=False, separators=(",", ":"))
payload = payload.replace("</", "<\\/")
html = open(tpl, encoding="utf-8").read().replace("/*__DATA__*/null", payload)
open(out, "w", encoding="utf-8").write(html)
print(len(data), "rows,", len(chaps), "chapters,", "QĐ cột:", [l for _, l in QD], ",", round(len(html.encode()) / 1e6, 2), "MB")
