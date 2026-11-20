"""Gói trang đã build thành ky-thuat/index.html của Trieu's Note (favicon, màu thanh trình duyệt dùng chung).
Phiên bản ?v= lấy theo style.css trong index.html gốc của Trieu's Note."""
import re, sys
from pathlib import Path
src, out = sys.argv[1], sys.argv[2]
root = Path(__file__).resolve().parents[2]  # webapp/
v = re.search(r'style\.css\?v=([\w.-]+)', (root / 'index.html').read_text(encoding='utf-8')).group(1)
body = open(src, encoding='utf-8').read().replace('__V__', v)  # logo.svg?v=__V__ trong template
head = f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f2ede2">
<meta name="color-scheme" content="light">
<link rel="icon" href="../logo.svg?v={v}" type="image/svg+xml">
<link rel="icon" href="../favicon-32.png?v={v}" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="../apple-touch-icon.png?v={v}">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
'''
# chuyển <title>/<meta>/<link>/<style> của trang vào <head>, phần còn lại vào <body>
i = body.index('<header>')
open(out, 'w', encoding='utf-8').write(head + body[:i] + '</head>\n<body>\n' + body[i:] + '\n</body>\n</html>\n')
print('->', out, 'v' + v)
