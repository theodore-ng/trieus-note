import openpyxl, sys, json, re
xlsx, tpl, out, procs_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
import unicodedata
sys.stdout.reconfigure(encoding='utf-8')
wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
rows = list(wb.worksheets[0].iter_rows(values_only=True))[1:]

def s(v):
    if v is None: return ''
    if isinstance(v, float) and v.is_integer(): v = int(v)
    return str(v).replace('\xa0', ' ').strip()

def price(v):
    t = s(v)
    if re.fullmatch(r'\d[\d,]*', t): return int(t.replace(',', ''))
    return t  # giữ nguyên giá trị lỗi/bất thường như trong file

chaps, cks = [], []
def idx(lst, v):
    if v not in lst: lst.append(v)
    return lst.index(v)

data = []
for r in rows:
    data.append([
        s(r[0]), idx(chaps, s(r[1])), s(r[2]), s(r[3]), s(r[4]), s(r[5]), s(r[6]), s(r[7]),
        s(r[8]), s(r[9]), s(r[10]), s(r[11]), price(r[12]), s(r[13]), s(r[14]),
        price(r[15]), price(r[16]), s(r[17]), price(r[18]), s(r[19]),
        idx(cks, s(r[20])), s(r[21]), s(r[22]), s(r[23]), s(r[24]), s(r[25]), s(r[26]), s(r[27]),
    ])

def key(s):
    s = unicodedata.normalize('NFD', s.replace('đ', 'd').replace('Đ', 'D').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    s = re.sub(r'^phau thuat ', '', s)
    for a, b in [('cat bo ', 'cat '), ('noi cac mach mau than kinh', 'noi mach mau'), ('luoi loc mau', 'luoi loc'), (' 5 10 cm', ' 5 den 10 cm')]:
        s = s.replace(a, b)
    return s
procs = json.load(open(procs_path, encoding='utf-8'))
rk = [key(r[4]) for r in data]
for pr in procs:
    k = key(pr['t'])
    pr['rows'] = [i for i, x in enumerate(rk) if x == k]
    print(len(pr['rows']), pr['t'][:60], [data[i][2] for i in pr['rows']])
payload = json.dumps({'chaps': chaps, 'cks': cks, 'rows': data, 'procs': procs}, ensure_ascii=False, separators=(',', ':'))
payload = payload.replace('</', '<\\/')
html = open(tpl, encoding='utf-8').read().replace('/*__DATA__*/null', payload)
open(out, 'w', encoding='utf-8').write(html)
print(len(data), 'rows,', round(len(html.encode()) / 1e6, 2), 'MB')
