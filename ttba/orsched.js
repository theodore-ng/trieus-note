"use strict";
/* OR Schedule → Google Calendar, chạy trên trình duyệt (bản chuyển từ repo riêng operation-schedule, Python).
   Gmail (email "lịch mổ" có .xlsx, chưa gắn nhãn schedule-processed, trong N ngày gần nhất) → đọc Excel trong bộ nhớ
   → lọc KHOA chứa "Pt tim" → MỘT sự kiện cả ngày / ngày mổ trên Google Calendar (không có tên bệnh nhân) → gắn nhãn email.
   File Excel không lưu lại ở đâu; chỉ tiêu đề + mô tả sự kiện (số ca, phòng mổ, thứ tự, tên phẫu thuật tiếng Anh) rời trình duyệt. */
const ORS = (() => {
  const DEPARTMENT = "pt tim";
  const EMAIL_QUERY = "has:attachment filename:.xlsx subject:lịch mổ";
  const LABEL = "schedule-processed";
  const PREFIX = "OR Schedule";
  const COLS = { order: "STT", room: "PMO", dept: "KHOA", diagnosis: "CHẨN ĐOÁN", procedure: "PP PHẨU THUẬT" }; // chỉ đọc các cột cần (không đọc họ tên)
  const DATE_RE = /NGÀ[YY]\s+(\d{2})[./](\d{2})[./](\d{4})/i;

  // ---- phân nhóm + dịch (giữ nguyên subspecialty.py) ----
  const ORDER = ["Coronary", "Valve", "Cardiac Tumor", "Carotid/Cerebrovascular", "Aorta", "Peripheral Arterial", "Venous", "Vascular Access"];
  const LABELS = { Coronary: "Coronary Artery Disease", Valve: "Valve Disease", "Cardiac Tumor": "Cardiac Tumor", "Carotid/Cerebrovascular": "Carotid Disease",
    Aorta: "Aortic Aneurysm", "Peripheral Arterial": "Peripheral Artery Disease", Venous: "Venous Insufficiency", "Vascular Access": "Renal Disease", Other: "Other" };
  const KEYWORDS = [
    ["Coronary", ["động mạch vành", "mạch vành"]],
    ["Valve", ["van hai lá", "van ba lá", "van động mạch chủ", "van tim", "thay van", "sửa van"]],
    ["Cardiac Tumor", ["u nhày", "u nhầy", "khối u tim", "bướu tim", "u tim"]],
    ["Carotid/Cerebrovascular", ["động mạch cảnh", "vùng cổ - nền cổ", "vùng cổ"]],
    ["Aorta", ["động mạch chủ", "quai động mạch chủ"]],
    ["Peripheral Arterial", ["động mạch chi", "động mạch đùi", "động mạch khoeo", "động mạch chậu"]],
    ["Venous", ["tĩnh mạch"]],
    ["Vascular Access", ["fav", "chạy thận", "cầu nối chạy thận", "catheter"]],
  ];
  const KNOWN = {
    "điều trị suy tĩnh mạch bằng laser nội mạch": "Endovenous laser ablation for venous insufficiency",
    "phẫu thuật tạo fav": "Arteriovenous fistula (AVF) creation",
    "phẫu thuật thay đoạn động mạch chủ lên. phẫu thuật bắc cầu động mạch chủ với các động mạch xuất phát từ quai động mạch chủ":
      "Ascending aortic segment replacement with bypass grafting of aortic arch branch vessels",
    "phẫu thuật bắc cầu các động mạch vùng cổ - nền cổ": "Cervico-cranial base arterial bypass",
    "phẫu thuật bắc cầu động mạch chủ - động mạch vành": "Aorto-coronary artery bypass grafting (CABG)",
    "phẫu thuật nội soi thay van hai lá": "Minimally invasive (endoscopic) mitral valve replacement",
    "phẫu thuật bắc cầu động mạch cảnh chung trái - động mạch cảnh trong trái": "Left common-to-internal carotid artery bypass",
    "phẫu thuật thay van động mạch chủ và động mạch chủ lên": "Aortic valve replacement with ascending aorta replacement",
    "phẫu thuật cắt u nhày nhĩ trái": "Resection of left atrial myxoma",
  };
  const FRAGMENTS = [
    ["bắc cầu động mạch chủ - động mạch vành", "aorto-coronary bypass"], ["bắc cầu động mạch vành", "coronary artery bypass"],
    ["động mạch vành", "coronary artery"], ["quai động mạch chủ", "aortic arch"], ["đoạn động mạch chủ lên", "ascending aortic segment"],
    ["động mạch chủ", "aorta"], ["động mạch cảnh", "carotid artery"], ["tĩnh mạch chi dưới", "lower-limb vein"],
    ["suy tĩnh mạch", "venous insufficiency"], ["tĩnh mạch", "vein"], ["van hai lá", "mitral valve"], ["van ba lá", "tricuspid valve"],
    ["van động mạch chủ", "aortic valve"], ["thay van", "valve replacement"], ["sửa van", "valve repair"], ["bắc cầu", "bypass"],
    ["nội soi", "minimally invasive"], ["tạo fav", "AV fistula creation"], ["bóc nội mạc", "endarterectomy"], ["đặt stent", "stent placement"],
    ["cắt", "resection"], ["nối", "anastomosis"], ["ghép", "graft"], ["vá", "patch repair"],
  ];
  const VI_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nfc = s => String(s ?? "").normalize("NFC");

  function classify(diagnosis, procedure) {
    const t = nfc(`${diagnosis} ${procedure}`).toLowerCase();
    for (const [name, kws] of KEYWORDS) if (kws.some(k => t.includes(k))) return name;
    return "Other";
  }
  function translate(procedure) {
    if (!procedure) return "";
    const key = nfc(procedure).trim().toLowerCase();
    if (KNOWN[key]) return KNOWN[key];
    let out = nfc(procedure);
    for (const [vi, en] of FRAGMENTS) out = out.replace(new RegExp(escRe(vi), "gi"), en);
    return VI_RE.test(out) ? `${procedure} [translation unverified — needs manual review]` : out;
  }

  // ---- đọc bảng (mảng các dòng, mỗi dòng mảng ô dạng chữ) — giữ logic schedule_parser.py ----
  function parseRows(rows) {
    const norm = v => (v == null ? "" : String(v).trim());
    // dòng tiêu đề: dòng đầu tiên có cả KHOA và STT (file mẫu là dòng thứ 5)
    const hi = rows.findIndex(r => r && r.some(c => norm(c).toLowerCase() === "khoa") && r.some(c => norm(c).toLowerCase() === "stt"));
    if (hi < 0) throw new Error("Header row (STT / KHOA) not found in the spreadsheet");
    const head = rows[hi].map(c => norm(c).toLowerCase());
    const col = Object.fromEntries(Object.entries(COLS).map(([k, n]) => [k, head.indexOf(n.toLowerCase())]));
    if (col.dept < 0) throw new Error("KHOA column not found");
    const data = rows.slice(hi + 1).map((r, i) => ({ i, get: k => (col[k] >= 0 ? norm((r || [])[col[k]]) : "") }));
    // thứ tự trong phòng mổ tính trên CẢ bảng (mọi khoa dùng chung phòng), trước khi lọc khoa
    const pos = new Map(), byRoom = new Map();
    for (const d of data) { const room = d.get("room"); if (room) (byRoom.get(room) || byRoom.set(room, []).get(room)).push(d); }
    const sortKey = d => { const n = /^-?\d+$/.test(d.get("order")) ? parseInt(d.get("order"), 10) : null; return n == null ? [1, d.i] : [0, n]; };
    for (const list of byRoom.values()) {
      list.sort((a, b) => { const x = sortKey(a), y = sortKey(b); return x[0] - y[0] || x[1] - y[1]; });
      list.forEach((d, j) => pos.set(d.i, [j + 1, list.length]));
    }
    return data.filter(d => d.get("dept").toLowerCase().includes(DEPARTMENT)).map(d => ({
      order: d.get("order"), room: d.get("room"), diagnosis: d.get("diagnosis"), procedure: d.get("procedure"),
      position: pos.get(d.i)?.[0] ?? null, count: pos.get(d.i)?.[1] ?? null,
    }));
  }

  // ---- sự kiện (giữ calendar_updater.py) ----
  const plural = n => (n === 1 ? "1 case" : `${n} cases`);
  function groups(ops) {
    const g = new Map();
    for (const op of ops) { const s = classify(op.diagnosis, op.procedure); (g.get(s) || g.set(s, []).get(s)).push(op); }
    const key = s => { const o = g.get(s).map(x => parseInt(x.order, 10)).filter(Number.isFinite); return [o.length ? Math.min(...o) : Infinity, ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length]; };
    const order = [...g.keys()].sort((a, b) => { const x = key(a), y = key(b); return (x[0] - y[0]) || (x[1] - y[1]); });
    return order.map(s => [s, g.get(s)]);
  }
  function eventText(ops) {
    const gs = groups(ops), total = ops.length;
    const title = `${PREFIX} · ${plural(total)} (${gs.map(([s, l]) => `${l.length} ${LABELS[s] || s}`).join(" · ")})`;
    const lines = [];
    for (const [s, l] of gs) {
      lines.push(`${(LABELS[s] || s).toUpperCase()} — ${plural(l.length)}`);
      for (const op of l) lines.push(`  • ${op.room ? "OR " + op.room : "OR n/a"} — ${op.position ? `Case ${op.position} of ${op.count}` : "Case"} — ${translate(op.procedure) || "(procedure not specified)"}`);
      lines.push("");
    }
    lines.push(`Total: ${plural(total)}`);
    return { title, description: lines.join("\n").trim() };
  }
  function opDate(subject) {
    const m = DATE_RE.exec(nfc(subject));
    if (!m) return null;
    const [d, mo, y] = [+m[1], +m[2], +m[3]], dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  }

  // ---- Google API (fetch + token của Google Identity Services) ----
  async function api(token, url, opt = {}) {
    const r = await fetch(url, { ...opt, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) { let m = r.status + ""; try { m = (await r.json()).error?.message || m; } catch {} throw Object.assign(new Error(m), { status: r.status }); }
    return r.status === 204 ? null : r.json();
  }
  const GM = "https://gmail.googleapis.com/gmail/v1/users/me", CAL = "https://www.googleapis.com/calendar/v3/calendars/";
  const b64 = s => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const nextDay = d => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

  /** Chạy toàn bộ. opts: {token, calendarId, days, dryRun, readXlsx(bytes) → rows}. Trả về danh sách kết quả từng email. */
  async function run({ token, calendarId = "primary", days = 2, dryRun = false, readXlsx }) {
    const labels = (await api(token, `${GM}/labels`)).labels || [];
    let labelId = labels.find(l => l.name === LABEL)?.id;
    if (!labelId && !dryRun) labelId = (await api(token, `${GM}/labels`, { method: "POST", body: JSON.stringify({ name: LABEL, labelListVisibility: "labelHide" }) })).id;
    const after = Math.floor((Date.now() - days * 864e5) / 1000);
    const q = `${EMAIL_QUERY} after:${after} -label:${LABEL}`;
    const msgs = (await api(token, `${GM}/messages?q=${encodeURIComponent(q)}`)).messages || [];
    const out = [];
    const calBase = CAL + encodeURIComponent(calendarId) + "/events";
    for (const { id } of msgs) {
      const res = { id };
      try {
        const msg = await api(token, `${GM}/messages/${id}?format=full`);
        const subject = (msg.payload?.headers || []).find(h => h.name.toLowerCase() === "subject")?.value || "";
        res.date = opDate(subject);
        if (!res.date) { res.status = "nodate"; out.push(res); continue; }
        const flat = [], stack = [...(msg.payload?.parts || [])];
        while (stack.length) { const p = stack.pop(); if (p.parts?.length) stack.push(...p.parts); else flat.push(p); }
        const part = flat.find(p => (p.filename || "").toLowerCase().endsWith(".xlsx") || (p.mimeType || "").includes("spreadsheet"));
        let ops = null;
        if (part?.body?.attachmentId) {
          const att = await api(token, `${GM}/messages/${id}/attachments/${part.body.attachmentId}`);
          ops = parseRows(readXlsx(b64(att.data)));
        }
        if (ops && ops.length) {
          const ev = await api(token, `${calBase}?singleEvents=true&timeMin=${res.date}T00:00:00%2B07:00&timeMax=${res.date}T23:59:59%2B07:00&fields=items(summary)`);
          const { title, description } = eventText(ops);
          res.title = title; res.description = description; res.cases = ops.length;
          if ((ev.items || []).some(e => (e.summary || "").startsWith(PREFIX))) res.status = "exists";
          else if (dryRun) res.status = "preview";
          else {
            await api(token, calBase, { method: "POST", body: JSON.stringify({ summary: title, description, start: { date: res.date }, end: { date: nextDay(res.date) }, colorId: "11" }) });
            res.status = "created";
          }
        } else res.status = part ? "nocases" : "noxlsx";
        if (!dryRun && labelId) await api(token, `${GM}/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: [labelId] }) });
      } catch (e) { res.status = "error"; res.error = e.message; } // không gắn nhãn → lần sau thử lại
      out.push(res);
    }
    return out;
  }

  return { classify, translate, parseRows, eventText, opDate, run, PREFIX };
})();
