r"""Bản thử web app Trieu's Note để kiểm tra bằng Edge headless (không đụng repo, không dùng dữ liệu thật).

Cách dùng (Git Bash, từ gốc dự án Trieu's Note, thư mục chứa .venv):
  .venv/Scripts/python webapp/scripts/dev/harness.py <thư mục đích> ['<biểu thức JS cần đọc>']
  (cd <thư mục đích> && python -m http.server 8768 &)
  EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  timeout 60 "$EDGE" --headless=new --disable-gpu --virtual-time-budget=12000 \
    --dump-dom "http://localhost:8768/finance/index.html?lotdate=2020-01-15#portfolio" | grep -o 'data-err="[^"]*"\|data-probe="[^"]*"'
  timeout 60 "$EDGE" --headless=new --disable-gpu --virtual-time-budget=12000 --window-size=1100,760 \
    --screenshot=shot.png "http://localhost:8768/finance/index.html#portfolio"

- Luôn bọc Edge bằng `timeout`. Edge headless không dựng trang hẹp hơn ~495px: muốn xem bản điện thoại dùng --window-size=520,…
- Trang: index.html (trang chủ), notes/index.html (Ghi chú: n1 có Markdown/checklist/bảng + nhãn, n2–n3 thường,
  n4 lưu trữ, n5 trong thùng rác, n6 thùng rác quá 30 ngày phải tự xóa; mở một ghi chú bằng #n1), pad/index.html,
  finance/index.html (Quản lý tài chính).
- Tham số URL của finance: lotdate=YYYY-MM-DD (ngày mua lô vàng mẫu), prof=balanced|aggressive, dep=1 (thêm nạp 100 tr),
  subs={"tab":"mục con"} (đã URL-encode) để mở đúng mục con.
- data-err = lỗi JS; data-probe = kết quả biểu thức JS truyền vào (đọc sau 5 giây), có ở cả 3 trang.
- Dữ liệu mẫu tài chính: 10 lượng SJC giá vốn 66 tr, 200 tr tiền mặt, đã bán 2 lượng ngày 2026-11-10.
  Đọc data/ local, không gọi Supabase (config.js để trống = chế độ cục bộ).
"""
import os, re, shutil, sys

W = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # gốc repo webapp/ (file này ở scripts/dev/)
U = os.path.abspath(sys.argv[1])
probe = sys.argv[2] if len(sys.argv) > 2 else "''"

shutil.copytree(W, U, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "__pycache__"))
open(os.path.join(U, "config.js"), "w", encoding="utf-8").write("window.QV_CONFIG = {};\n")  # chế độ cục bộ
for f, pat, rep in (("finance/app.js", r"^const PRICE_URLS = .*$", 'const PRICE_URLS = ["../data/prices.json"];'),
                    ("finance/macro.js", r"^const RAW = .*$", 'const RAW = "../data/";')):
    p = os.path.join(U, f)
    t = re.sub(pat, rep, open(p, encoding="utf-8").read(), flags=re.M)
    open(p, "w", encoding="utf-8").write(t)

ERR = '<script>window.__err=[];addEventListener("error",e=>__err.push(e.message+" @"+e.filename+":"+e.lineno));</script>\n'
END = ('<script>setTimeout(()=>{document.body.setAttribute("data-err",JSON.stringify(__err));'
       'document.body.setAttribute("data-probe",' + probe + ')},5000)</script></body>')

FINANCE = '''<script>
const q=new URLSearchParams(location.search);
localStorage.setItem("quyvang_sub", q.get("subs")||"{}");
localStorage.removeItem("quyvang_open");
localStorage.setItem("quyvang_v1", JSON.stringify({v:1,created:"2026-01-01",cash0:200,
  lots:[{id:"a1",date:q.get("lotdate")||null,luong:10,cost:66,kind:"sjc",note:"SJC"}],
  tx:[{id:"t1",seq:1,type:"sell",date:"2026-11-10",luong:2,price:138.2}].concat(q.get("dep")?[{id:"t2",seq:2,type:"cash",date:"2024-06-01",amount:100}]:[]),
  sec:[],settings:{plan:{v:2,profile:q.get("prof")||"balanced",risk:"balanced"}}}));
</script>
'''
NOTES = '''<script>const ago=(d)=>new Date(Date.now()-d*864e5).toISOString();
localStorage.removeItem("trieusnote_ui");
localStorage.setItem("trieusnote_notes_v1", JSON.stringify([
  {id:"n1",title:"Việc tuần này",body:"## Việc cần làm\\n- [ ] Rà soát danh mục\\n- [x] Đọc báo cáo **vĩ mô**\\n\\n| Mã | Giá |\\n|---|---|\\n| FUEVFVND | 30 |\\n\\n[CafeF](https://cafef.vn)",pinned:true,tags:["việc","tài chính"],created_at:"2026-11-01T02:00:00Z",updated_at:"2026-11-18T02:00:00Z"},
  {id:"n2",title:"Ý tưởng",body:"Thêm app theo dõi sức khỏe",pinned:false,tags:["ý tưởng"],created_at:"2026-11-02T02:00:00Z",updated_at:"2026-11-19T02:00:00Z"},
  {id:"n3",title:"",body:"Ghi chú không tiêu đề",pinned:false,created_at:"2026-11-03T02:00:00Z",updated_at:"2026-11-10T02:00:00Z"},
  {id:"n4",title:"Ghi chú cũ đã lưu trữ",body:"Nội dung lưu trữ",archived:true,tags:["việc"],created_at:"2026-10-01T02:00:00Z",updated_at:"2026-10-02T02:00:00Z"},
  {id:"n5",title:"Trong thùng rác",body:"Xóa 5 ngày trước",deleted_at:ago(5),created_at:"2026-10-01T02:00:00Z",updated_at:"2026-10-02T02:00:00Z"},
  {id:"n6",title:"Quá hạn thùng rác",body:"Xóa 31 ngày trước, phải tự xóa hẳn",deleted_at:ago(31),created_at:"2026-09-01T02:00:00Z",updated_at:"2026-09-02T02:00:00Z"}]));</script>
'''

# (trang, dữ liệu mẫu chèn trước script đầu tiên của app)
for rel, seed, before in (("index.html", "", '<script src="core.js'),
                          ("notes/index.html", NOTES, '<script src="../core.js'),
                          ("finance/index.html", FINANCE, '<script src="plan.js')):
    t = open(os.path.join(W, rel), encoding="utf-8").read()
    i = t.index(before)
    t = t[:i] + ERR + seed + t[i:]
    open(os.path.join(U, rel), "w", encoding="utf-8").write(t.replace("</body>", END, 1))
print("harness ready:", U)
