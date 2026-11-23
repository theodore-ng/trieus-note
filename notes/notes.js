"use strict";
/* Ghi chú: lưu Supabase (bảng notes, RLS theo người dùng) khi đã cấu hình, hoặc localStorage (chế độ cục bộ).
   Ghi chú: {id, title, body (Markdown), pinned, archived, deleted_at (thùng rác), tags[], created_at, updated_at}.
   Ghi chú đang mở nằm trong hash (#<id>) nên nút Back của điện thoại quay về danh sách.
   Thư mục đang xem, nhãn đang lọc và chế độ Viết/Xem nhớ trong localStorage `trieusnote_ui`. */
(async () => {
  const { $, esc, sb } = TN;
  const KEY = "trieusnote_notes_v1", UI_KEY = "trieusnote_ui", TRASH_DAYS = 30, PENDING = "trieusnote_pending";
  const COLS = "id, title, body, pinned, archived, deleted_at, tags, created_at, updated_at";
  const f = $("#noteForm"), pv = $("#preview");
  let user = null, notes = [], cur = null, pending = null, timer = null;
  const ui = { view: "all", tag: "", mode: "view" };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY)) || {}); } catch { /* bỏ qua */ }
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* bỏ qua */ } };

  /** Bỏ dấu tiếng Việt để tìm "ghi chu" vẫn ra "Ghi chú". */
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  const fmt = (iso) => {
    const d = new Date(iso), tz = { timeZone: "Asia/Ho_Chi_Minh" };
    return d.toLocaleDateString("vi-VN", { ...tz, day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("vi-VN", { ...tz, hour: "2-digit", minute: "2-digit" });
  };
  const now = () => new Date().toISOString();
  const norm = (n) => ({ pinned: false, archived: false, deleted_at: null, ...n, tags: Array.isArray(n.tags) ? n.tags : [] });
  const blank = (n) => !n.title.trim() && !n.body.trim() && !n.tags.length;
  const byId = (id) => notes.find((n) => n.id === id);
  const viewOf = (n) => (n.deleted_at ? "trash" : n.archived ? "archive" : "all");
  const daysLeft = (n) => Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - new Date(n.deleted_at)) / 864e5));
  const state = (t, err) => ($("#saveState").innerHTML = err ? `<span class="warn">${esc(t)}</span>` : esc(t));

  const store = sb ? {
    async all() { const { data, error } = await sb.from("notes").select(COLS); if (error) throw error; return data; },
    async put(n) { const { error } = await sb.from("notes").upsert({ ...n, user_id: user.id }); if (error) throw error; },
    async del(id) { const { error } = await sb.from("notes").delete().eq("id", id); if (error) throw error; },
  } : { // cục bộ: ghi lại cả mảng sau mỗi thay đổi
    async all() { return JSON.parse(localStorage.getItem(KEY) || "[]"); },
    async put() { localStorage.setItem(KEY, JSON.stringify(notes)); },
    async del() { localStorage.setItem(KEY, JSON.stringify(notes)); },
  };

  /* ---------- lưu ---------- */
  async function flush() {
    clearTimeout(timer);
    const n = pending;
    if (!n) return;
    pending = null;
    try { await store.put(n); state("Đã lưu ✓"); } catch (e) { pending ||= n; state("Lỗi lưu: " + e.message, true); }
  }
  /** Đánh dấu ghi chú đã đổi; `soon` = lưu ngay (thao tác nút), không thì chờ 600 ms (đang gõ). */
  function changed(n, soon) {
    n.updated_at = now();
    pending = n;
    state("Đang lưu…");
    clearTimeout(timer);
    timer = setTimeout(flush, soon ? 0 : 600);
    renderSide();
    renderMeta();
  }

  /* ---------- Markdown + checklist ---------- */
  if (window.DOMPurify) DOMPurify.addHook("afterSanitizeAttributes", (el) => {
    if (el.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
  });
  const md = (src) => (window.marked && window.DOMPurify
    ? DOMPurify.sanitize(marked.parse(src, { gfm: true, breaks: true }))
    : `<pre>${esc(src)}</pre>`);
  const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/;
  /** Đổi trạng thái việc thứ i trong nội dung (bỏ qua dòng trong khối ```code```). */
  function toggleTask(body, i) {
    let k = -1, fence = false;
    return body.split("\n").map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence || !TASK.test(line)) return line;
      return ++k === i ? line.replace(TASK, (m, pre, x) => `${pre}[${x === " " ? "x" : " "}]`) : line;
    }).join("\n");
  }
  function renderPreview() {
    pv.innerHTML = cur.body.trim() ? md(cur.body) : '<p class="muted">Ghi chú trống. Bấm <b>Viết</b> để soạn.</p>';
    pv.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => { cb.disabled = !!cur.deleted_at; cb.dataset.i = i; });
  }
  pv.addEventListener("change", (e) => {
    const cb = e.target.closest('input[type="checkbox"][data-i]');
    if (!cb || !cur || cur.deleted_at) return;
    cur.body = toggleTask(cur.body, +cb.dataset.i);
    f.body.value = cur.body;
    changed(cur, true);
  });

  /* ---------- danh sách bên trái ---------- */
  const inView = () => notes.filter((n) => viewOf(n) === ui.view);
  function renderSide() {
    const counts = { all: 0, archive: 0, trash: 0 };
    notes.forEach((n) => counts[viewOf(n)]++);
    document.querySelectorAll("#views button").forEach((b) => {
      b.classList.toggle("on", b.dataset.v === ui.view);
      b.querySelector("span").textContent = counts[b.dataset.v] || "";
    });
    $("#trashNote").hidden = ui.view !== "trash";

    const tagCount = new Map();
    inView().forEach((n) => n.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
    if (ui.tag && !tagCount.has(ui.tag)) ui.tag = "";
    const tags = [...tagCount.keys()].sort((a, b) => a.localeCompare(b, "vi"));
    $("#tagbar").innerHTML = tags.map((t) => `<button type="button" class="tag${t === ui.tag ? " on" : ""}" data-tag="${esc(t)}">#${esc(t)} <span>${tagCount.get(t)}</span></button>`).join("");
    $("#tagList").innerHTML = [...new Set(notes.flatMap((n) => n.tags))].map((t) => `<option value="${esc(t)}">`).join("");

    const q = fold($("#q").value.trim());
    const shown = inView()
      .filter((n) => (!ui.tag || n.tags.includes(ui.tag)) && (!q || fold(`${n.title} ${n.body} ${n.tags.join(" ")}`).includes(q)))
      .sort((a, b) => (ui.view === "all" ? b.pinned - a.pinned : 0) || b.updated_at.localeCompare(a.updated_at));
    const empty = { all: "Chưa có ghi chú.", archive: "Chưa có ghi chú lưu trữ.", trash: "Thùng rác trống." }[ui.view];
    $("#list").innerHTML = shown.map((n) => {
      const snip = n.body
        .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, "")            // dòng kẻ bảng
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm, "")      // gạch đầu dòng, checklist
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|]/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 90);
      return `<li><a href="#${n.id}" class="${n === cur ? "on" : ""}">
        <b>${n.pinned && !n.deleted_at ? "📌 " : ""}${esc(n.title.trim() || "(Không tiêu đề)")}</b>
        <span class="muted small">${esc(snip)}</span>
        ${n.tags.length ? `<span class="ltags">${n.tags.map((t) => `<i>#${esc(t)}</i>`).join("")}</span>` : ""}
        <span class="muted small">${n.deleted_at ? `Xóa ${fmt(n.deleted_at)} · còn ${daysLeft(n)} ngày` : fmt(n.updated_at)}</span></a></li>`;
    }).join("") || `<li class="muted small">${q || ui.tag ? "Không có ghi chú khớp." : empty}</li>`;
    $("#count").textContent = `${shown.length} ghi chú`;
  }

  /* ---------- trình soạn ---------- */
  function renderMeta() {
    if (!cur) return;
    $("#meta").textContent = `Tạo ${fmt(cur.created_at)} · Sửa ${fmt(cur.updated_at)}`
      + (cur.deleted_at ? ` · Trong thùng rác, tự xóa sau ${daysLeft(cur)} ngày` : cur.archived ? " · Đã lưu trữ" : "");
  }
  function renderTags() {
    $("#noteTags").innerHTML = cur.tags.map((t, i) => `<span class="tag">#${esc(t)}${cur.deleted_at ? "" : `<button type="button" data-rm="${i}" aria-label="Bỏ nhãn ${esc(t)}">×</button>`}</span>`).join("");
  }
  function setMode(mode) {
    ui.mode = cur?.deleted_at ? "view" : mode;
    saveUi();
    const view = ui.mode === "view";
    f.body.hidden = view;
    pv.hidden = !view;
    if (view && cur) renderPreview();
    f.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === ui.mode));
  }
  function renderEditor() {
    const trash = !!cur.deleted_at;
    f.title.value = cur.title;
    f.body.value = cur.body;
    f.title.readOnly = trash;
    $("#tagIn").hidden = trash;
    $("#btnPin").setAttribute("aria-pressed", cur.pinned);
    $("#btnPin").textContent = cur.pinned ? "Bỏ ghim" : "Ghim";
    $("#btnArchive").textContent = cur.archived ? "Bỏ lưu trữ" : "Lưu trữ";
    for (const id of ["btnPin", "btnArchive", "btnDel"]) $("#" + id).hidden = trash;
    for (const id of ["btnRestore", "btnPurge"]) $("#" + id).hidden = !trash;
    f.querySelector(".seg").hidden = trash;
    renderTags();
    renderMeta();
    setMode(blank(cur) ? "edit" : ui.mode);
  }

  /** Rời ghi chú đang mở: lưu nốt, bỏ ghi chú mới tạo mà để trống. */
  async function leave() {
    await flush();
    if (cur && blank(cur) && !cur.deleted_at) {
      const n = cur;
      notes = notes.filter((x) => x !== n);
      try { await store.del(n.id); } catch { /* chưa từng lưu */ }
    }
    cur = null;
  }

  async function show(id) {
    if (cur && cur.id !== id) await leave();
    cur = byId(id) || null;
    if (cur && viewOf(cur) !== ui.view) { ui.view = viewOf(cur); saveUi(); }
    $("#notes").classList.toggle("editing", !!cur);
    $("#empty").hidden = !!cur;
    f.hidden = !cur;
    if (cur) {
      renderEditor();
      if (blank(cur)) f.title.focus({ preventScroll: true }); // mở ghi chú cũ thì không bật bàn phím điện thoại
    }
    renderSide();
  }
  const route = () => show(location.hash.slice(1));

  /* ---------- khởi động ---------- */
  if (sb) {
    user = await TN.currentUser();
    if (!user) { // đăng nhập ở trang chủ; giữ ghi chú đang gửi từ iPhone để nhận sau khi đăng nhập
      if (location.hash.startsWith("#import")) try { sessionStorage.setItem(PENDING, location.hash); } catch { /* bỏ qua */ }
      location.replace("../"); return;
    }
  }
  try { notes = (await store.all()).map(norm); } catch (e) {
    const box = $("#loadErr");
    box.hidden = false;
    box.textContent = "Không tải được ghi chú: " + e.message
      + (sb ? " — cần chạy phần notes trong supabase/schema.sql trên Supabase (tạo bảng hoặc thêm cột mới)." : "");
    return; // không ghi đè dữ liệu khi đọc lỗi
  }
  // Dọn thùng rác quá hạn
  const expired = notes.filter((n) => n.deleted_at && daysLeft(n) === 0);
  if (expired.length) {
    notes = notes.filter((n) => !expired.includes(n));
    for (const n of expired) { try { await store.del(n.id); } catch { /* thử lại lần sau */ } }
  }
  $("#notes").hidden = false;
  if (!sb) state("Chế độ cục bộ");

  /* ---------- sự kiện ---------- */
  f.addEventListener("input", (e) => {
    if (!cur || cur.deleted_at || e.target.id === "tagIn") return;
    cur.title = f.title.value;
    cur.body = f.body.value;
    changed(cur);
  });
  f.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  $("#btnPin").onclick = () => { cur.pinned = !cur.pinned; renderEditor(); changed(cur, true); };
  $("#btnArchive").onclick = () => {
    cur.archived = !cur.archived;
    ui.view = viewOf(cur); saveUi();
    renderEditor(); changed(cur, true);
  };
  $("#btnDel").onclick = async () => {
    if (blank(cur)) { location.hash = ""; return; } // ghi chú trống: leave() tự bỏ
    cur.deleted_at = now();
    changed(cur, true);
    await flush();
    location.hash = "";
  };
  $("#btnRestore").onclick = () => { cur.deleted_at = null; ui.view = viewOf(cur); saveUi(); renderEditor(); changed(cur, true); };
  $("#btnPurge").onclick = async () => {
    if (!confirm(`Xóa vĩnh viễn "${cur.title.trim() || "(Không tiêu đề)"}"? Không khôi phục được.`)) return;
    const n = cur;
    clearTimeout(timer); pending = null;
    try { notes = notes.filter((x) => x !== n); await store.del(n.id); } catch (e) { notes.push(n); alert("Không xóa được: " + e.message); return; }
    cur = null;
    location.hash = "";
  };

  // Nhãn: Enter hoặc dấu phẩy để thêm; × để bỏ
  function addTags(raw) {
    const add = raw.split(",").map((t) => t.replace(/^#+/, "").trim()).filter(Boolean);
    let n = 0;
    for (const t of add) if (!cur.tags.some((x) => x.toLowerCase() === t.toLowerCase())) { cur.tags.push(t); n++; }
    if (n) { renderTags(); changed(cur, true); }
  }
  $("#tagIn").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTags(e.target.value); e.target.value = ""; }
  });
  $("#tagIn").addEventListener("change", (e) => { if (e.target.value.trim()) { addTags(e.target.value); e.target.value = ""; } });
  $("#noteTags").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (b) { cur.tags.splice(+b.dataset.rm, 1); renderTags(); changed(cur, true); }
  });

  $("#views").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    ui.view = b.dataset.v; ui.tag = ""; saveUi();
    if (cur && viewOf(cur) !== ui.view) location.hash = ""; else renderSide();
  });
  $("#tagbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (b) { ui.tag = ui.tag === b.dataset.tag ? "" : b.dataset.tag; saveUi(); renderSide(); }
  });
  $("#q").addEventListener("input", renderSide);
  $("#btnNew").onclick = () => {
    const t = now();
    const n = norm({ id: crypto.randomUUID(), title: "", body: "", created_at: t, updated_at: t, tags: ui.tag ? [ui.tag] : [] });
    notes.push(n);
    ui.view = "all"; saveUi();
    $("#q").value = "";
    location.hash = n.id;
  };

  // Sao lưu
  $("#btnExport").onclick = () => TN.download(`ghi-chu-${TN.today()}.json`, { v: 2, notes });
  /** Đọc mọi đối tượng JSON cấp ngoài cùng trong văn bản: mảng, {notes:[…]}, hoặc nhiều {…} nối tiếp
      (phím tắt iPhone ghép từng ghi chú thành văn bản nên không chắc ra một mảng JSON chuẩn). */
  function parseObjects(text) {
    const s = text.replace(/^﻿/, "").trim();
    try { const x = JSON.parse(s); return Array.isArray(x) ? x : Array.isArray(x.notes) ? x.notes : [x]; } catch { /* thử tách từng đối tượng */ }
    const out = [];
    let depth = 0, start = -1, str = false, escp = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (str) { if (escp) escp = false; else if (c === "\\") escp = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true;
      else if (c === "{") { if (!depth++) start = i; }
      else if (c === "}" && depth && !--depth) out.push(JSON.parse(s.slice(start, i + 1)));
    }
    if (!out.length) throw new Error("không tìm thấy ghi chú nào trong file");
    return out.flatMap((x) => (Array.isArray(x.notes) ? x.notes : [x]));
  }
  /** Mã cố định cho ghi chú từ iPhone (tiêu đề + ngày tạo) để nhập lại không bị trùng: UUID dạng v5 từ SHA-256. */
  async function stableId(key) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))).slice(0, 16);
    h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
    const x = [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
  }
  const iso = (v) => { const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
  /** Ghi chú từ phím tắt iPhone: {title, body, created, modified, folder} → ghi chú của app, gắn nhãn iPhone + thư mục. */
  async function fromApple(a) {
    const title = String(a.title ?? "").trim(), body = String(a.body ?? "").replace(/\r\n?/g, "\n");
    const created = iso(a.created) || now(), modified = iso(a.modified) || created;
    // Notes dùng dòng đầu làm tiêu đề: không có tiêu đề riêng thì lấy dòng đầu; dòng đầu trùng tiêu đề thì bỏ cho gọn
    const lines = body.split("\n"), first = (lines[0] || "").replace(/^#+\s*/, "").trim();
    const b = first && (!title || first === title) ? lines.slice(1).join("\n").replace(/^\n+/, "") : body;
    const tags = ["iPhone", ...(a.folder ? [String(a.folder).trim()] : [])].filter(Boolean);
    // mã cố định theo tiêu đề + ngày tạo gốc (chuỗi thô, để ngày không đọc được vẫn ra cùng mã khi nhập lại)
    return norm({ id: await stableId(`apple-notes|${title || first}|${a.created ?? ""}`), title: title || first || "(Không tiêu đề)", body: b, created_at: created, updated_at: modified, tags });
  }

  $("#fileImport").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const arr = parseObjects(await file.text());
      const backup = (n) => n && typeof n.id === "string" && typeof n.title === "string" && typeof n.body === "string" && n.created_at && n.updated_at;
      const apple = (n) => n && !n.id && ("title" in n || "body" in n);
      let items, src;
      if (arr.every(backup)) { items = arr.map(norm); src = "sao lưu"; }
      else if (arr.every(apple)) { items = await Promise.all(arr.map(fromApple)); src = "Ghi chú iPhone"; }
      else throw new Error("file không đúng định dạng sao lưu ghi chú hoặc file xuất từ Ghi chú iPhone");
      const fresh = items.filter((n, i) => !byId(n.id) && items.findIndex((m) => m.id === n.id) === i);
      const skip = items.length - fresh.length;
      if (!fresh.length) { alert(`Không có ghi chú mới (${items.length} ghi chú trong file đã có).`); return; }
      if (!confirm(`Nhập ${fresh.length} ghi chú mới từ ${src}${skip ? ` (bỏ qua ${skip} ghi chú đã có)` : ""}? Ghi chú đã có không bị thay đổi.`)) return;
      notes.push(...fresh);
      for (const n of fresh) await store.put(n);
      state(`Đã nhập ${fresh.length} ghi chú ✓`);
      renderSide();
    } catch (err) { alert("Không nhập được: " + err.message); }
  };

  /** Nhận 1 ghi chú gửi từ phím tắt iPhone qua địa chỉ: …/notes/#import&title=…&body=… (title tùy chọn; body là Markdown).
      Hash không được gửi lên máy chủ. Gửi lại cùng nội dung thì báo đã có, không tạo bản trùng. */
  async function takeImport(hash) {
    const q = new URLSearchParams(hash.replace(/^#import[?&]?/, ""));
    const body = q.get("body") || q.get("text") || "";
    if (!body.trim() && !(q.get("title") || "").trim()) { history.replaceState(null, "", location.pathname); return false; }
    const n = await fromApple({ title: q.get("title") || "", body, folder: q.get("folder") || "" });
    n.id = await stableId(`apple-share|${n.title}|${n.body}`);
    const have = byId(n.id);
    if (have) { alert("Ghi chú này đã được nhập trước đó."); location.replace("#" + have.id); return true; }
    if (!confirm(`Thêm ghi chú từ iPhone: "${n.title}"?`)) { history.replaceState(null, "", location.pathname); return false; }
    notes.push(n);
    try { await store.put(n); state("Đã nhập từ iPhone ✓"); } catch (e) { notes.pop(); alert("Không lưu được: " + e.message); return false; }
    ui.view = "all"; saveUi();
    location.replace("#" + n.id);
    return true;
  }
  let pend = location.hash.startsWith("#import") ? location.hash : null;
  try { pend ||= sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); } catch { /* bỏ qua */ }
  if (pend) await takeImport(pend);

  addEventListener("hashchange", () => (location.hash.startsWith("#import") ? takeImport(location.hash) : route()));
  addEventListener("visibilitychange", () => document.hidden && flush());
  addEventListener("beforeunload", (e) => { if (pending) { flush(); e.preventDefault(); } });
  route();
})();
