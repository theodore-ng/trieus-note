"use strict";
/* Ghi chú: lưu Supabase (bảng notes, RLS theo người dùng) khi đã cấu hình, hoặc localStorage (chế độ cục bộ).
   Ghi chú: {id, title, body (Markdown), pinned, archived, deleted_at (thùng rác), tags[], created_at, updated_at}.
   Ghi chú đang mở nằm trong hash (#<id>) nên nút Back của điện thoại quay về danh sách.
   Thư mục đang xem, nhãn đang lọc và chế độ Viết/Xem nhớ trong localStorage `trieusnote_ui`. */
(async () => {
  const { $, esc, sb } = TN;
  const KEY = "trieusnote_notes_v1", UI_KEY = "trieusnote_ui", TRASH_DAYS = 30;
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
    if (!user) { location.replace("../"); return; } // đăng nhập ở trang chủ
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
  $("#fileImport").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const x = JSON.parse(await file.text()), arr = Array.isArray(x) ? x : x.notes;
      const ok = (n) => n && typeof n.id === "string" && typeof n.title === "string" && typeof n.body === "string" && n.created_at && n.updated_at;
      if (!Array.isArray(arr) || !arr.every(ok)) throw new Error("file không đúng định dạng sao lưu ghi chú");
      const fresh = arr.filter((n) => !byId(n.id)).map(norm);
      if (!fresh.length) { alert("Không có ghi chú mới (mọi ghi chú trong file đã có)."); return; }
      if (!confirm(`Nhập ${fresh.length} ghi chú mới? Ghi chú đã có không bị thay đổi.`)) return;
      notes.push(...fresh);
      for (const n of fresh) await store.put(n);
      state(`Đã nhập ${fresh.length} ghi chú ✓`);
      renderSide();
    } catch (err) { alert("Không nhập được: " + err.message); }
  };

  addEventListener("hashchange", route);
  addEventListener("visibilitychange", () => document.hidden && flush());
  addEventListener("beforeunload", (e) => { if (pending) { flush(); e.preventDefault(); } });
  route();
})();
