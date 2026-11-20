"""Split the Word file into procedures (one per Heading 1) as HTML, keep list numbering, tables, images."""
import sys, json, base64, html, re
import docx
from docx.oxml.ns import qn

def esc(s): return html.escape(s, quote=False)

def numbering_formats(doc):
    fmts = {}  # (numId, ilvl) -> (numFmt, lvlText, start)
    try:
        root = doc.part.numbering_part.element
    except Exception:
        return fmts
    absd = {}
    for a in root.findall(qn('w:abstractNum')):
        aid = a.get(qn('w:abstractNumId'))
        lv = {}
        for l in a.findall(qn('w:lvl')):
            il = int(l.get(qn('w:ilvl')))
            g = lambda tag: (l.find(qn(tag)).get(qn('w:val')) if l.find(qn(tag)) is not None else None)
            lv[il] = (g('w:numFmt') or 'bullet', g('w:lvlText') or '', int(g('w:start') or 1))
        absd[aid] = lv
    for n in root.findall(qn('w:num')):
        nid = n.get(qn('w:numId'))
        aid = n.find(qn('w:abstractNumId')).get(qn('w:val'))
        for il, v in absd.get(aid, {}).items():
            fmts[(nid, il)] = v
    return fmts

def roman(n):
    out = ''
    for v, s in [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
        while n >= v: out += s; n -= v
    return out

def fmtnum(fmt, n):
    if fmt == 'decimal': return str(n)
    if fmt == 'lowerLetter': return chr(96 + (n - 1) % 26 + 1)
    if fmt == 'upperLetter': return chr(64 + (n - 1) % 26 + 1)
    if fmt == 'upperRoman': return roman(n)
    if fmt == 'lowerRoman': return roman(n).lower()
    return str(n)

def main(path, out):
    doc = docx.Document(path)
    fmts = numbering_formats(doc)
    body = doc.element.body
    procs, cur = [], None
    counters = {}

    def runs_html(p):
        o = ''
        for child in p.iter():
            if child.tag == qn('w:r'):
                t = ''.join((x.text or '') if x.tag == qn('w:t') else ('\n' if x.tag in (qn('w:br'), qn('w:cr')) else ('\t' if x.tag == qn('w:tab') else ''))
                            for x in child)
                rpr = child.find(qn('w:rPr'))
                b = rpr is not None and rpr.find(qn('w:b')) is not None and rpr.find(qn('w:b')).get(qn('w:val')) not in ('0', 'false')
                i = rpr is not None and rpr.find(qn('w:i')) is not None and rpr.find(qn('w:i')).get(qn('w:val')) not in ('0', 'false')
                sup = rpr is not None and rpr.find(qn('w:vertAlign')) is not None and rpr.find(qn('w:vertAlign')).get(qn('w:val'))
                s = esc(t).replace('\n', '<br>').replace('\t', ' ')
                if s:
                    if sup == 'superscript': s = f'<sup>{s}</sup>'
                    if sup == 'subscript': s = f'<sub>{s}</sub>'
                    if i: s = f'<i>{s}</i>'
                    if b: s = f'<b>{s}</b>'
                    o += s
                for blip in child.iter(qn('a:blip')):
                    rid = blip.get(qn('r:embed'))
                    try:
                        part = doc.part.related_parts[rid]
                        o += f'<img alt="Hình minh họa" src="data:{part.content_type};base64,{base64.b64encode(part.blob).decode()}">'
                    except KeyError:
                        pass
        return re.sub(r'</b><b>', '', o)

    def para_html(p):
        ppr = p.find(qn('w:pPr'))
        style = ''
        if ppr is not None and ppr.find(qn('w:pStyle')) is not None:
            style = ppr.find(qn('w:pStyle')).get(qn('w:val'))
        content = runs_html(p)
        text = ''.join(t.text or '' for t in p.iter(qn('w:t'))).strip()
        num = ppr.find(qn('w:numPr')) if ppr is not None else None
        if num is not None and num.find(qn('w:numId')) is not None and text:
            nid = num.find(qn('w:numId')).get(qn('w:val'))
            il = int(num.find(qn('w:ilvl')).get(qn('w:val'))) if num.find(qn('w:ilvl')) is not None else 0
            fmt, lt, start = fmts.get((nid, il), ('bullet', '•', 1))
            key = nid
            c = counters.setdefault(key, {})
            for deeper in [k for k in c if k > il]: del c[deeper]
            c[il] = c.get(il, start - 1) + 1
            if fmt == 'bullet' or fmt == 'none':
                marker = '–' if lt in ('-', '–', '') or not lt.strip() or ord(lt[0]) > 0xF000 else esc(lt)
                if fmt == 'none': marker = ''
            else:
                marker = lt
                for k in range(il + 1):
                    f2 = fmts.get((nid, k), ('decimal', '', 1))[0]
                    marker = marker.replace(f'%{k+1}', fmtnum(f2, c.get(k, 1)))
                marker = esc(marker)
            return f'<p class="li l{min(il,3)}"><span class="mk">{marker}</span><span>{content}</span></p>', style, text
        if not text and '<img' not in content:
            return '', style, text
        cls = ''
        if re.match(r'^[IVX]+\.\s', text): cls = ' class="h2"'
        elif re.match(r'^\d+(\.\d+)*\.?\s', text) and len(text) < 120 and content.startswith('<b>'): cls = ' class="h3"'
        return f'<p{cls}>{content}</p>', style, text

    def table_html(tbl):
        o = '<div class="tw"><table>'
        for tr in tbl.findall(qn('w:tr')):
            o += '<tr>'
            for tc in tr.findall(qn('w:tc')):
                tcpr = tc.find(qn('w:tcPr'))
                span = 1; vm = None
                if tcpr is not None:
                    gs = tcpr.find(qn('w:gridSpan'))
                    if gs is not None: span = int(gs.get(qn('w:val')))
                    v = tcpr.find(qn('w:vMerge'))
                    if v is not None: vm = v.get(qn('w:val')) or 'continue'
                if vm == 'continue':
                    o += f'<td{f" colspan={span}" if span > 1 else ""} class="cont"></td>'
                    continue
                inner = ''
                for p in tc.findall(qn('w:p')):
                    h, _, _ = para_html(p)
                    inner += h
                o += f'<td{f" colspan={span}" if span > 1 else ""}>{inner}</td>'
            o += '</tr>'
        return o + '</table></div>'

    for el in body.iterchildren():
        if el.tag == qn('w:p'):
            h, style, text = para_html(el)
            if style.lower().replace(' ', '') in ('heading1',) and text:
                title = ''.join((x.text or '') if x.tag == qn('w:t') else ' ' for x in el.iter(qn('w:t'), qn('w:br'), qn('w:cr')))
                cur = {'t': re.sub(r'\s+', ' ', title).strip(), 'h': ''}
                procs.append(cur); counters.clear()
                continue
            if cur is not None and h: cur['h'] += h
        elif el.tag == qn('w:tbl') and cur is not None:
            cur['h'] += table_html(el)
    # drop trailing signature block if it landed in the last procedure
    json.dump(procs, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(procs), 'procedures', sum(len(p['h']) for p in procs) // 1000, 'KB html')
    for p in procs: print(' ', p['t'][:70], len(p['h']))

sys.stdout.reconfigure(encoding="utf-8")
main(sys.argv[1], sys.argv[2])
