"use strict";
/* Ghi chú: lưu Supabase (bảng notes, RLS theo người dùng) khi đã cấu hình, hoặc localStorage (chế độ cục bộ).
   Ghi chú đang mở nằm trong hash (#<id>) nên nút Back của điện thoại quay về danh sách. */
(async () => {
  const { $, esc, sb } = TN;
  const KEY = "trieusnote_notes_v1";
  const f = $("#noteForm");
  let user = null, notes = [], cur = null, pending = null, timer = null;

  /** Bỏ dấu tiếng Việt để tìm "ghi chu" vẫn ra "Ghi chú". */
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  const fmt = (iso) => {
    const d = new Date(iso), tz = { timeZone: "Asia/Ho_Chi_Minh" };
    return d.toLocaleDateString("vi-VN", { ...tz, day: "2-digit", month: "2-digit", year: "numeric" })
      + " " + d.toLocaleTimeString("vi-VN", { ...tz, hour: "2-digit", minute: "2-digit" });
  };
  const blank = (n) => !n.title.trim() && !n.body.trim();
  const byId = (id) => notes.find((n) => n.id === id);
  const state = (t, err) => ($("#saveState").innerHTML = err ? `<span class="warn">${esc(t)}</span>` : esc(t));

  const store = sb ? {
    async all() {
      const { data, error } = await sb.from("notes").select("id, title, body, pinned, created_at, updated_at");
      if (error) throw error;
      return data;
    },
    async put(n) { const { error } = await sb.from("notes").upsert({ ...n, user_id: user.id }); if (error) throw error; },
    async del(id) { const { error } = await sb.from("notes").delete().eq("id", id); if (error) throw error; },
  } : { // cục bộ: ghi lại cả mảng sau mỗi thay đổi
    async all() { return JSON.parse(localStorage.getItem(KEY) || "[]"); },
    async put() { localStorage.setItem(KEY, JSON.stringify(notes)); },
    async del() { localStorage.setItem(KEY, JSON.stringify(notes)); },
  };

  async function flush() {
    clearTimeout(timer);
    const n = pending;
    if (!n) return;
    pending = null;
    try { await store.put(n); state("Đã lưu ✓"); } catch (e) { pending ||= n; state("Lỗi lưu: " + e.message, true); }
  }

  function edited() {
    Object.assign(cur, { title: f.title.value, body: f.body.value, pinned: f.pinned.checked, updated_at: new Date().toISOString() });
    pending = cur;
    state("Đang lưu…");
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
    $("#meta").textContent = "Sửa " + fmt(cur.updated_at);
    renderList();
  }

  /** Rời ghi chú đang mở: lưu nốt, bỏ ghi chú mới tạo mà để trống. */
  async function leave() {
    await flush();
    if (cur && blank(cur)) {
      const n = cur;
      notes = notes.filter((x) => x !== n);
      try { await store.del(n.id); } catch { /* chưa từng lưu */ }
    }
    cur = null;
  }

  function renderList() {
    const q = fold($("#q").value.trim());
    const shown = notes
      .filter((n) => !q || fold(n.title + " " + n.body).includes(q))
      .sort((a, b) => b.pinned - a.pinned || b.updated_at.localeCompare(a.updated_at));
    $("#list").innerHTML = shown.map((n) => `<li><a href="#${n.id}" class="${n === cur ? "on" : ""}">
      <b>${n.pinned ? "📌 " : ""}${esc(n.title.trim() || "(Không tiêu đề)")}</b>
      <span class="muted small">${esc(n.body.slice(0, 90))}</span>
      <span class="muted small">${fmt(n.updated_at)}</span></a></li>`).join("")
      || `<li class="muted small">${q ? "Không có ghi chú khớp." : "Chưa có ghi chú."}</li>`;
    $("#count").textContent = notes.length + " ghi chú";
  }

  async function show(id) {
    if (cur && cur.id !== id) await leave();
    cur = byId(id) || null;
    $("#notes").classList.toggle("editing", !!cur);
    $("#empty").hidden = !!cur;
    f.hidden = !cur;
    if (cur) {
      f.title.value = cur.title; f.body.value = cur.body; f.pinned.checked = cur.pinned;
      $("#meta").textContent = "Sửa " + fmt(cur.updated_at);
      if (blank(cur)) f.title.focus({ preventScroll: true }); // mở ghi chú cũ thì không bật bàn phím điện thoại
    }
    renderList();
  }
  const route = () => show(location.hash.slice(1));

  // Khởi động
  if (sb) {
    user = await TN.currentUser();
    if (!user) { location.replace("../"); return; } // đăng nhập ở trang chủ
  }
  try { notes = await store.all(); } catch (e) {
    const box = $("#loadErr");
    box.hidden = false;
    box.textContent = "Không tải được ghi chú: " + e.message
      + (sb ? " — nếu chưa tạo bảng, chạy phần notes trong supabase/schema.sql trên Supabase." : "");
    return; // không ghi đè dữ liệu khi đọc lỗi
  }
  $("#notes").hidden = false;
  if (!sb) state("Chế độ cục bộ");

  f.addEventListener("input", edited);
  $("#q").addEventListener("input", renderList);
  $("#btnNew").onclick = () => {
    const now = new Date().toISOString();
    const n = { id: crypto.randomUUID(), title: "", body: "", pinned: false, created_at: now, updated_at: now };
    notes.push(n);
    $("#q").value = "";
    location.hash = n.id;
  };
  $("#btnDel").onclick = async () => {
    if (!cur || (!blank(cur) && !confirm(`Xóa ghi chú "${cur.title.trim() || "(Không tiêu đề)"}"?`))) return;
    const n = cur;
    clearTimeout(timer); pending = null;
    try { notes = notes.filter((x) => x !== n); await store.del(n.id); } catch (e) { notes.push(n); alert("Không xóa được: " + e.message); return; }
    cur = null;
    location.hash = "";
  };
  $("#btnExport").onclick = () => TN.download(`ghi-chu-${TN.today()}.json`, { v: 1, notes });
  addEventListener("hashchange", route);
  addEventListener("visibilitychange", () => document.hidden && flush());
  addEventListener("beforeunload", (e) => { if (pending) { flush(); e.preventDefault(); } });
  route();
})();
