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
    return d.toLocaleDateString("en-GB", { ...tz, day: "numeric", month: "short", year: "numeric" })
      + ", " + d.toLocaleTimeString("en-GB", { ...tz, hour: "2-digit", minute: "2-digit" });
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
    try { await store.put(n); state("Saved ✓"); } catch (e) { pending ||= n; state("Save failed: " + e.message, true); }
  }
  /** Đánh dấu ghi chú đã đổi; `soon` = lưu ngay (thao tác nút), không thì chờ 600 ms (đang gõ). */
  function changed(n, soon) {
    n.updated_at = now();
    pending = n;
    state("Saving…");
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
    pv.innerHTML = cur.body.trim() ? md(cur.body) : '<p class="muted">Empty note. Tap <b>Edit</b> to write.</p>';
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
    $("#btnEmptyTrash").hidden = !counts.trash;

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
    const empty = { all: "No notes yet.", archive: "No archived notes.", trash: "Trash is empty." }[ui.view];
    $("#list").innerHTML = shown.map((n) => {
      const snip = n.body
        .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, "")            // dòng kẻ bảng
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm, "")      // gạch đầu dòng, checklist
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|]/g, " ")
        .replace(/\s+/g, " ").trim().slice(0, 90);
      return `<li><a href="#${n.id}" class="${n === cur ? "on" : ""}">
        <b>${n.pinned && !n.deleted_at ? "📌 " : ""}${esc(n.title.trim() || "(Untitled)")}</b>
        <span class="muted small">${esc(snip)}</span>
        ${n.tags.length ? `<span class="ltags">${n.tags.map((t) => `<i>#${esc(t)}</i>`).join("")}</span>` : ""}
        <span class="muted small">${n.deleted_at ? `Deleted ${fmt(n.deleted_at)} · ${daysLeft(n)} days left` : fmt(n.updated_at)}</span></a></li>`;
    }).join("") || `<li class="muted small">${q || ui.tag ? "No matching notes." : empty}</li>`;
    $("#count").textContent = `${shown.length} note${shown.length === 1 ? "" : "s"}`;
  }

  /* ---------- trình soạn ---------- */
  function renderMeta() {
    if (!cur) return;
    $("#meta").textContent = `Created ${fmt(cur.created_at)} · Edited ${fmt(cur.updated_at)}`
      + (cur.deleted_at ? ` · In Trash, deleted permanently in ${daysLeft(cur)} days` : cur.archived ? " · Archived" : "");
  }
  function renderTags() {
    $("#noteTags").innerHTML = cur.tags.map((t, i) => `<span class="tag">#${esc(t)}${cur.deleted_at ? "" : `<button type="button" data-rm="${i}" aria-label="Remove tag ${esc(t)}">×</button>`}</span>`).join("");
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
    $("#btnPin").textContent = cur.pinned ? "Unpin" : "Pin";
    $("#btnArchive").textContent = cur.archived ? "Unarchive" : "Archive";
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
    box.textContent = "Could not load notes: " + e.message
      + (sb ? " — run the notes section of supabase/schema.sql in Supabase (creates the table or adds new columns)." : "");
    return; // không ghi đè dữ liệu khi đọc lỗi
  }
  // Dọn thùng rác quá hạn
  const expired = notes.filter((n) => n.deleted_at && daysLeft(n) === 0);
  if (expired.length) {
    notes = notes.filter((n) => !expired.includes(n));
    for (const n of expired) { try { await store.del(n.id); } catch { /* thử lại lần sau */ } }
  }
  $("#notes").hidden = false;
  if (!sb) state("Local mode");

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
    if (!confirm(`Delete "${cur.title.trim() || "(Untitled)"}" forever? This cannot be undone.`)) return;
    const n = cur;
    clearTimeout(timer); pending = null;
    try { notes = notes.filter((x) => x !== n); await store.del(n.id); } catch (e) { notes.push(n); alert("Could not delete: " + e.message); return; }
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
    return norm({ id: await stableId(`apple-notes|${title || first}|${a.created ?? ""}`), title: title || first || "(Untitled)", body: b, created_at: created, updated_at: modified, tags });
  }

  /** Tạo ghi chú từ chữ gửi sang (phím tắt hoặc nút Dán): dòng đầu = tiêu đề, nhãn #iPhone; cùng nội dung thì không tạo lại. */
  async function addShared({ title = "", body = "", folder = "" }, ask) {
    const n = await fromApple({ title, body, folder });
    n.id = await stableId(`apple-share|${n.title}|${n.body}`);
    const have = byId(n.id);
    if (have) { alert("This note was already imported."); location.replace("#" + have.id); return true; }
    if (ask && !confirm(`Add note from iPhone: "${n.title}"?`)) return false;
    notes.push(n);
    try { await store.put(n); state("Imported from iPhone ✓"); } catch (e) { notes.pop(); alert("Could not save: " + e.message); return false; }
    ui.view = "all"; saveUi();
    location.replace("#" + n.id);
    return true;
  }
  /** Nhận 1 ghi chú gửi từ phím tắt iPhone qua địa chỉ: …/notes/#import&title=…&body=… (title tùy chọn; body là Markdown).
      Hash không được gửi lên máy chủ. Gửi lại cùng nội dung thì báo đã có, không tạo bản trùng. */
  async function takeImport(hash) {
    const q = new URLSearchParams(hash.replace(/^#import[?&]?/, ""));
    const body = q.get("body") || q.get("text") || "", title = q.get("title") || "";
    if (!body.trim() && !title.trim()) { history.replaceState(null, "", location.pathname); return false; }
    const ok = await addShared({ title, body, folder: q.get("folder") || "" }, true); // từ địa chỉ trang: luôn hỏi trước
    if (!ok) history.replaceState(null, "", location.pathname);
    return ok;
  }
  // Nút Dán: lấy chữ vừa sao chép (vd chọn hết chữ trong app Notes › Copy) thành ghi chú mới
  $("#btnPaste").onclick = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { /* trình duyệt chặn đọc bộ nhớ tạm */ }
    if (!text.trim()) {
      alert("Could not read the clipboard. Tap New, then long-press in the content box › Paste.");
      return;
    }
    await addShared({ body: text }, false);
  };

  // + GitHub: dán link repo → ghi chú Tóm tắt + Review (github.js). Đã có thì cập nhật số liệu, giữ phần "Ghi chú của tôi".
  $("#btnGithub").onclick = async () => {
    const url = prompt("Paste a GitHub repo link (e.g. https://github.com/owner/repo):");
    if (!url) return;
    const p = GH.parse(url);
    if (!p) { alert("That is not a GitHub repo link (github.com/owner/repo)."); return; }
    const id = await stableId(`github|${p.owner}/${p.repo}`.toLowerCase());
    const have = byId(id);
    if (have && !confirm(`A note for "${have.title}" already exists. Refresh it with the latest data? Your "My notes" section is kept.`)) { location.hash = id; return; }
    const b = $("#btnGithub");
    b.disabled = true; state("Fetching from GitHub…");
    try {
      const g = GH.build(await GH.fetchRepo(p.owner, p.repo));
      const mine = have ? (have.body.split(GH.MINE)[1] ?? "").replace(/^\n+/, "") : "";
      const t = now();
      const n = have || norm({ id, created_at: t, title: "", body: "", tags: [] });
      Object.assign(n, { title: g.title, body: g.body + mine, updated_at: t, tags: [...new Set([...g.tags, ...(have?.tags || [])])], deleted_at: null });
      if (!have) notes.push(n);
      await store.put(n);
      state(`GitHub note ${have ? "updated" : "created"} ✓`);
      ui.view = viewOf(n); ui.mode = "view"; saveUi();
      if (location.hash === "#" + id) { cur = null; await show(id); } else location.hash = id;
    } catch (e) { state(e.message, true); alert("Could not fetch from GitHub: " + e.message); }
    b.disabled = false;
  };

  // Dọn sạch thùng rác (xóa vĩnh viễn mọi ghi chú trong thùng rác)
  $("#btnEmptyTrash").onclick = async () => {
    const trash = notes.filter((n) => n.deleted_at);
    if (!trash.length || !confirm(`Permanently delete ${trash.length} note${trash.length === 1 ? "" : "s"} in Trash? This cannot be undone.`)) return;
    if (cur?.deleted_at) { cur = null; history.replaceState(null, "", location.pathname); show(""); }
    notes = notes.filter((n) => !n.deleted_at);
    let fail = 0;
    for (const n of trash) { try { await store.del(n.id); } catch { fail++; } }
    if (fail) { alert(`Could not delete ${fail} note${fail === 1 ? "" : "s"}, try again later.`); notes = (await store.all()).map(norm); }
    state(fail ? "Emptying Trash failed" : `Deleted ${trash.length} note${trash.length === 1 ? "" : "s"} ✓`, !!fail);
    renderSide();
  };
  let pend =location.hash.startsWith("#import") ? location.hash : null;
  try { pend ||= sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); } catch { /* bỏ qua */ }
  if (pend) await takeImport(pend);

  addEventListener("hashchange", () => (location.hash.startsWith("#import") ? takeImport(location.hash) : route()));
  addEventListener("visibilitychange", () => document.hidden && flush());
  addEventListener("beforeunload", (e) => { if (pending) { flush(); e.preventDefault(); } });
  route();
})();
