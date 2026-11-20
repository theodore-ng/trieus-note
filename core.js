"use strict";
/* Trieu's Note: phần dùng chung cho trang chủ và các app con mới (Ghi chú...).
   App Quản lý tài chính (finance/) có bản riêng của các hàm này; phiên đăng nhập Supabase lưu theo origin nên dùng chung. */
const TN = (() => {
  const CFG = window.QV_CONFIG || {};
  const sb = CFG.supabaseUrl && CFG.supabaseKey && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

  /** Người dùng đang đăng nhập (null nếu chưa, hoặc chế độ cục bộ). */
  async function currentUser() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user || null;
  }

  /** Đăng nhập bằng tên đăng nhập (ghép tên miền email trong config.js) hoặc email đầy đủ. */
  async function signIn(name, pass) {
    const u = name.trim().toLowerCase();
    const email = u.includes("@") ? u : `${u}@${CFG.emailDomain}`;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    return error ? null : data.user;
  }

  async function signOut() { await sb.auth.signOut(); }

  async function profile(u) {
    const { data } = await sb.from("profiles").select("username, role").eq("id", u.id).maybeSingle();
    return { username: data?.username || u.email.split("@")[0], role: data?.role || "user" };
  }

  /** Phiên bản = tham số ?v= của style.css (tăng mỗi lần deploy). */
  function version() {
    return document.querySelector('link[href*="style.css"]')?.getAttribute("href").match(/v=([\w.-]+)/)?.[1] || "—";
  }

  function download(name, obj) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { sb, $, esc, today, currentUser, signIn, signOut, profile, version, download };
})();
