"""Trích quy trình từ PDF "Hướng dẫn quy trình kỹ thuật về Tuần hoàn" (Bộ Y tế 2025) theo byt_map.json → byt.json.
Dùng: python byt2procs.py byt_map.json <thư mục chứa PDF> byt.json
Mỗi mục: {t, h (HTML cùng định dạng với docx2procs: p.h2/p.h3/p.li), ref, url, vol, n, cr?, rel?, g?}.
Chữ trích tự động từ PDF: đoạn văn được nối lại theo dấu câu, bảng biểu có thể lệch dòng."""
import html, json, os, re, sys
from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")
map_path, pdf_dir, out_path = sys.argv[1:4]
M = json.load(open(map_path, encoding="utf-8"))

BULLET = re.compile(r"^[−–\-•+*▪●]\s*")
H2 = re.compile(r"^(\d{1,2})\.\s+(\S.*)$")
H3 = re.compile(r"^(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\.?\s+(\S.*)$")
UP = lambda s: s == s.upper() and any(c.isalpha() for c in s)

def load(vol):
    f = os.path.join(pdf_dir, M["vols"][vol]["file"])
    lines = []
    for p in PdfReader(f).pages:
        for l in (p.extract_text() or "").split("\n"):
            s = l.strip()
            if not s or re.fullmatch(r"\d{1,3}", s):  # dòng trống, số trang
                continue
            lines.append(s)
    # bỏ phần mục lục: nội dung bắt đầu sau lần cuối "DANH MỤC CÁC TỪ VIẾT TẮT" + bảng viết tắt; tìm tiêu đề quy trình từ sau đó
    start = max(i for i, l in enumerate(lines) if l.startswith("DANH MỤC CÁC TỪ VIẾT TẮT"))
    return lines[start:]

def find(lines, n):
    """Vị trí tiêu đề quy trình n (dòng in hoa '<n>. ...' ngay trước '1. ĐẠI CƯƠNG') và hết ở tiêu đề kế tiếp."""
    heads = []
    for i, l in enumerate(lines):
        m = re.match(r"^(\d{1,3})\.\s+(\S.*)$", l)
        if m and UP(m.group(2)) and not re.match(r"^\d{1,2}\.\s+(ĐẠI CƯƠNG|CHỈ ĐỊNH|CHỐNG CHỈ ĐỊNH|THẬN TRỌNG|CHUẨN BỊ|TIẾN HÀNH|THEO DÕI|TÀI LIỆU)", l):
            # phải có '1. ĐẠI CƯƠNG' trong vài dòng sau
            if any(re.match(r"^1\.\s+ĐẠI CƯƠNG", x) for x in lines[i + 1:i + 6]):
                heads.append((int(m.group(1)), i))
    pos = [i for k, i in heads if k == n]
    if not pos:
        raise SystemExit(f"Không tìm thấy quy trình số {n}")
    i = pos[0]
    nxt = [j for k, j in heads if j > i]
    end = nxt[0] if nxt else len(lines)
    t = [lines[i].split(".", 1)[1].strip()]
    j = i + 1
    while j < end and not re.match(r"^1\.\s+ĐẠI CƯƠNG", lines[j]) and UP(lines[j]):
        t.append(lines[j]); j += 1
    return " ".join(t), lines[j:end]

def to_html(body):
    blocks = []  # [kind, text, level]
    for l in body:
        if l.startswith("TÀI LIỆU THAM KHẢO"):
            break
        m2, m3, mb = H2.match(l), H3.match(l), BULLET.match(l)
        if m3 and len(l) < 140:
            blocks.append(["h3", l, 0])
        elif m2 and UP(m2.group(2)):
            blocks.append(["h2", l, 0])
        elif mb:
            blocks.append(["li", BULLET.sub("", l), 1 if l[0] in "+▪" else 0])
        elif re.match(r"^[a-zđ]\)\s", l) or re.match(r"^Bước \d", l):
            blocks.append(["li", l, 0])
        elif blocks and blocks[-1][0] in ("p", "li") and not re.search(r"[.:;!?]$", blocks[-1][1]):
            blocks[-1][1] += " " + l  # dòng tiếp theo của cùng đoạn
        elif blocks and blocks[-1][0] in ("h2", "h3") and not UP(l) and blocks[-1][1].endswith(("và", "của", ",")):
            blocks[-1][1] += " " + l
        else:
            blocks.append(["p", l, 0])
    out = []
    for kind, txt, lv in blocks:
        e = html.escape(re.sub(r"\s+", " ", txt).strip())
        if kind == "h2":
            out.append(f'<p class="h2"><b>{e}</b></p>')
        elif kind == "h3":
            out.append(f'<p class="h3"><b>{e}</b></p>')
        elif kind == "li":
            out.append(f'<p class="li l{lv + 1}"><span class="mk">{"–" if lv == 0 else "+"}</span><span>{e}</span></p>')
        else:
            out.append(f"<p>{e}</p>")
    return "".join(out)

cache, res = {}, []
for it in M["items"]:
    v = it["vol"]
    if v not in cache:
        cache[v] = load(v)
    title, body = find(cache[v], it["n"])
    meta = M["vols"][v]
    h = to_html(body)
    res.append({**{k: it[k] for k in ("vol", "n", "cr", "rel", "g") if k in it}, "t": title, "h": h,
                "ref": f'{meta["name"]} ({meta["qd"]}), mục {it["n"]}', "url": meta["url"]})
    print(f'{v} #{it["n"]:>3} {"→ CR#" + str(it["cr"]) if "cr" in it else "(thêm)":<8} {title[:70]}  ({len(h) // 1000}k)')
json.dump(res, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
print(len(res), "quy trình →", out_path)
