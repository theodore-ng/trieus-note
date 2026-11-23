r"""Kiểm tra heparin/heparin.js khớp 100% với bản TypeScript gốc (heparin.ts, protocols.ts, references.ts của heparin-web-app).

Cách dùng (Git Bash, từ gốc dự án):
  .venv/Scripts/python webapp/scripts/heparin/parity.py <thư mục tạm>
  (cd <thư mục tạm> && python -m http.server 8776 &)
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --virtual-time-budget=30000 \
    --dump-dom http://localhost:8776/parity.html | grep -o 'data-result="[^"]*'
Trang nạp trình biên dịch TypeScript (cdnjs), dịch chính các file .ts gốc, rồi so với heparin.js:
PROTOCOLS + REFERENCES (toàn bộ dữ liệu), formatBandRange, calcInitialDose và calcAPTTAdjustment trên lưới đầu vào quanh mọi ngưỡng.
Kết quả "OK <số ca>" là khớp. (Obscura không chạy được vì trang dùng XHR đồng bộ.)
"""
import os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[1])
os.makedirs(out, exist_ok=True)
for f in ("heparin.ts", "protocols.ts", "references.ts"):
    shutil.copy(os.path.join(HERE, f), out)
shutil.copy(os.path.join(HERE, "..", "..", "heparin", "heparin.js"), out)
open(os.path.join(out, "parity.html"), "w", encoding="utf-8").write(r"""<!doctype html><meta charset="utf-8"><body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/typescript/5.4.5/typescript.min.js"></script>
<script src="heparin.js"></script>
<script>
const get = (f) => { const x = new XMLHttpRequest(); x.open("GET", f, false); x.send(); return x.responseText; };
// Dịch TS gốc: bỏ import/export rồi gộp thành một hàm trả về các hàm/dữ liệu cần so
const src = ["protocols.ts", "references.ts", "heparin.ts"].map(get).join("\n")
  .replace(/^import .*$/gm, "").replace(/^export (default )?/gm, "");
const js = ts.transpile(src, { target: ts.ScriptTarget.ES2020 });
const T = new Function(js + "\nreturn { PROTOCOLS, REFERENCES, DEFAULT_PROTOCOL_ID, getProtocol, calcInitialDose, calcAPTTAdjustment, formatBandRange };")();
const S = (v) => JSON.stringify(v, (k, x) => (x === Infinity ? "Inf" : x));
const bad = []; let n = 0;
const cmp = (name, a, b) => { n++; if (S(a) !== S(b)) bad.push({ name, ts: a, js: b }); };
const run = (f) => { try { return f(); } catch (e) { return "ERR:" + e.message; } };
cmp("PROTOCOLS", T.PROTOCOLS, HEP.PROTOCOLS);
cmp("REFERENCES", T.REFERENCES, HEP.REFERENCES);
cmp("DEFAULT", T.DEFAULT_PROTOCOL_ID, HEP.DEFAULT_PROTOCOL_ID);
for (const id of ["vte", "stemi_rtpa", "pci_only", "x", ""]) cmp("getProtocol " + id, T.getProtocol(id).id, HEP.getProtocol(id).id);
for (const p of T.PROTOCOLS) for (const b of p.apttBands || []) cmp("band " + p.id, T.formatBandRange(b), HEP.formatBandRange(b));
const W = [0.5, 1, 33.3, 45, 50, 55.5, 66.6, 66.7, 70, 83.3, 83.4, 100, 114.3, 120.7, 142.9, 150, 200, 250];
const C = [250, 100, 500, 25000 / 48, 25000 / 50, 12500 / 250, 1000, 40];
for (const p of T.PROTOCOLS.filter((x) => x.calculable)) for (const w of W) for (const c of C)
  cmp(`init ${p.id} ${w} ${c}`, run(() => T.calcInitialDose(w, p, c)), run(() => HEP.calcInitialDose(w, HEP.getProtocol(p.id), c)));
const A = [-1, 0, 1, 39, 39.9, 40, 49, 49.99, 50, 59, 59.9, 60, 70, 70.5, 71, 90, 90.5, 91, 100, 100.5, 101, 120, 120.5, 121, 200, 500];
const R = [0, 50, 100, 280, 500, 840, 1260, 1500, 2000];
for (const p of T.PROTOCOLS.filter((x) => x.apttBands)) for (const a of A) for (const w of [45, 70, 83.3, 120, 200]) for (const r of R) for (const c of [250, 500, 100])
  cmp(`adj ${p.id} ${a} ${w} ${r} ${c}`, run(() => T.calcAPTTAdjustment(a, w, r, p.apttBands, c)), run(() => HEP.calcAPTTAdjustment(a, w, r, HEP.getProtocol(p.id).apttBands, c)));
document.body.dataset.result = bad.length ? "FAIL " + bad.length + "/" + n + " " + S(bad.slice(0, 3)) : "OK " + n;
</script>""")
print("->", out)
