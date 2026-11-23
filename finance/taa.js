"use strict";
/* Điều chỉnh chiến thuật (TAA, CFA Level III: tactical asset allocation) quanh phân bổ chiến lược (SAA, plan.js).
   Chấm điểm tín hiệu thị trường cho từng lớp (+1 thuận / −1 nghịch) → nghiêng tỷ trọng tối đa ±TAA_BAND điểm %,
   tổng mức nghiêng = 0 (phần dư vào tiền mặt + tiết kiệm), giữ ràng buộc IPS (bounds()).
   Chỉ khi người dùng bấm "Áp dụng" mới lưu mức nghiêng vào S.settings.tilt; targetMix() cộng mức nghiêng đó vào SAA hiện hành,
   nên SAA vẫn tự cập nhật theo CME. Vệ tinh không nghiêng (CFA giả định alpha = 0). Dùng tiện ích của app.js, macro.js, plan.js. */
const TAA_BAND = 5;     // điểm % tối đa mỗi lớp
const TAA_REVIEW = 90;  // ngày: sau đó nhắc xem lại
const TAA_KEYS = ["liquid", "bond", "equity", "gold"];

/** Tín hiệu cho từng lớp. Một số tín hiệu (VN-Index/MA200, suy thoái) đã nằm trong CME của SAA nên không lặp lại ở cổ phiếu. */
function taaSignals() {
  const sig = { liquid: [], bond: [], equity: [], gold: [] };
  const add = (k, name, value, dir, why) => sig[k].push({ name, value, dir, why });
  const m = M?.markets || {}, p = planCfg(), c = cme(p, p.horizon), dep = depNow(p), cpi = vn("cpiYoy");
  const ph = cyclePhase();
  const rec = recessionChecks().reduce((s, x) => s + (x.level === "alert" ? 2 : x.level === "warn" ? 1 : 0), 0);

  // Vàng: bảng yếu tố vàng VN (Thị trường › Vàng Việt Nam) + trạng thái đáy sau đỉnh
  const g = goldStats();
  if (g) goldFactors(g).forEach((f) => add("gold", f.name, f.value, f.dir, f.why));
  const b = goldBottom();
  if (b && b.dd <= -0.1) add("gold", "Đáy sau đỉnh (vàng thế giới)", `${b.hits}/${b.checks.length} mốc · ${b.status[0]}`,
    b.hits >= 5 ? 1 : b.hits >= 3 ? 0 : -1, b.hits >= 5 ? "Đáy đã được xác nhận: rủi ro giảm tiếp thấp hơn." : b.hits >= 3 ? "Đáy đang hình thành, chưa chắc chắn." : "Chưa xác nhận đáy: có thể còn giảm.");

  // Cổ phiếu lõi: dòng tiền, pha chu kỳ, phần bù rủi ro so với tiết kiệm
  const ff = flowFactors(), fs = ff.reduce((s, x) => s + x.dir, 0);
  if (ff.length) add("equity", "Dòng tiền (tổng hợp)", `${fs >= 0 ? "+" : ""}${fs} điểm / ${ff.length} yếu tố`, fs >= 2 ? 1 : fs <= -2 ? -1 : 0,
    fs >= 2 ? "Lãi suất thực, thanh khoản, tỷ giá, khẩu vị rủi ro nghiêng về tài sản rủi ro." : fs <= -2 ? "Dòng tiền nghiêng về tài sản an toàn." : "Trung tính, phân hóa (xem Vĩ mô & dòng tiền).");
  if (ph) add("equity", "Pha chu kỳ Việt Nam", ph.name, ph.key === "recovery" ? 1 : ph.key === "stagflation" ? -1 : 0,
    ph.key === "recovery" ? "Phục hồi: cổ phiếu thường tốt nhất (Investment Clock)." : ph.key === "stagflation" ? "Đình lạm: lợi nhuận doanh nghiệp bị bào mòn." : `Pha ${ph.name.toLowerCase()}: trung tính với cổ phiếu.`);
  const erp = c.r.equity - dep;
  add("equity", "Phần bù rủi ro cổ phiếu so với tiết kiệm", `${nf(erp, 1)} điểm % (${nf(c.r.equity, 1)}% − ${nf(dep, 1)}%)`, erp >= 5 ? 1 : erp < 2 ? -1 : 0,
    erp >= 5 ? "Phần bù dày: đáng nhận thêm rủi ro." : erp < 2 ? "Phần bù mỏng: rủi ro cổ phiếu chưa được trả công xứng đáng." : "Phần bù vừa phải.");

  // Quỹ trái phiếu: lợi suất so với tiết kiệm, hướng lãi suất, pha chu kỳ
  if (INV?.bondMedian12m != null) {
    const d = INV.bondMedian12m - dep;
    add("bond", "Lợi nhuận quỹ trái phiếu so với tiết kiệm", `${nf(INV.bondMedian12m, 2)}% so với ${nf(dep, 1)}%`, d > 0.5 ? 1 : d < -0.5 ? -1 : 0,
      d > 0.5 ? "Quỹ trái phiếu trả cao hơn tiết kiệm, lại rút linh hoạt." : d < -0.5 ? "Tiết kiệm có kỳ hạn đang trả tốt hơn." : "Tương đương tiết kiệm.");
  }
  if (m.us10y?.chg3m != null) add("bond", "Lợi suất Mỹ 10 năm 3 tháng", `${m.us10y.chg3m >= 0 ? "+" : "−"}${nf(Math.abs(m.us10y.chg3m), 2)} điểm`,
    m.us10y.chg3m > 0.15 ? -1 : m.us10y.chg3m < -0.15 ? 1 : 0, "Lãi suất tăng làm giá trái phiếu giảm; lãi suất giảm thì ngược lại.");
  if (ph) add("bond", "Pha chu kỳ Việt Nam", ph.name, ph.key === "reflation" ? 1 : ph.key === "overheat" ? -1 : 0,
    ph.key === "reflation" ? "Suy giảm: ngân hàng trung ương nới lỏng, trái phiếu thường tốt nhất." : ph.key === "overheat" ? "Tăng trưởng nóng: lãi suất có xu hướng tăng." : "Trung tính với trái phiếu.");

  // Tiền mặt + tiết kiệm: lãi suất thực, rủi ro suy thoái, đình lạm
  if (cpi) {
    const r = dep - cpi.value;
    add("liquid", "Lãi suất thực tiết kiệm", `${nf(r, 1)}% (${nf(dep, 1)}% − CPI ${nf(cpi.value, 2)}%)`, r > 2 ? 1 : r < 0 ? -1 : 0,
      r > 2 ? "Lãi thực cao: giữ tiền ở ngân hàng có lợi." : r < 0 ? "Lãi thực âm: tiền nhàn rỗi mất sức mua." : "Trung tính.");
  }
  add("liquid", "Rủi ro suy thoái toàn cầu", `${rec} điểm`, rec >= 6 ? 1 : 0, rec >= 6 ? "Cao: tăng thanh khoản để phòng thủ và chờ cơ hội." : "Chưa đến mức cần phòng thủ thêm.");
  if (ph) add("liquid", "Pha chu kỳ Việt Nam", ph.name, ph.key === "stagflation" ? 1 : ph.key === "recovery" ? -1 : 0,
    ph.key === "stagflation" ? "Đình lạm: tiền mặt, tiết kiệm ngắn hạn thường tốt nhất." : ph.key === "recovery" ? "Phục hồi: chi phí cơ hội của việc giữ tiền cao." : "Trung tính.");
  return sig;
}

/** Đặt mức nghiêng vào tỷ trọng SAA (%): giữ ràng buộc, tiền mặt + tiết kiệm nhận phần dư (không dưới quỹ khẩn cấp). */
function applyTilt(w, t, bd) {
  const r = { ...w }, clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  for (const k of ["bond", "equity", "gold"]) r[k] = clamp(w[k] + (t[k] || 0), bd[k]);
  r.liquid = 100 - r.bond - r.equity - r.gold - r.sat;
  if (r.liquid < bd.liquid[0]) { // thiếu thanh khoản: rút bớt phần đã tăng thêm, lớp tăng nhiều trước
    let need = bd.liquid[0] - r.liquid;
    for (const k of ["equity", "gold", "bond"].sort((a, b) => (r[b] - w[b]) - (r[a] - w[a]))) {
      const cut = Math.min(need, Math.max(0, r[k] - Math.max(w[k], bd[k][0])));
      r[k] -= cut; need -= cut;
    }
    r.liquid = 100 - r.bond - r.equity - r.gold - r.sat;
  }
  return r;
}

function taaStats(w, c) {
  let er = 0, v = 0;
  for (const i of OPT_KEYS) {
    er += (w[i] / 100) * c.r[i];
    for (const j of OPT_KEYS) v += (w[i] / 100) * (w[j] / 100) * c.v[i] * c.v[j] * CORR[i][j];
  }
  return { er, sd: Math.sqrt(v) };
}

/** Tính đề xuất: điểm từng lớp → mức nghiêng (đã cân về tổng 0, làm tròn điểm %) → TAA. */
function taaCompute(total) {
  const p = profCfg(), o = optimal(p.profile, total), bd = bounds(total, p), sig = taaSignals();
  const score = {}, raw = {};
  for (const k of TAA_KEYS) {
    const s = sig[k].reduce((a, x) => a + x.dir, 0), n = sig[k].length;
    score[k] = s;
    raw[k] = n ? Math.max(-1, Math.min(1, s / Math.max(2, Math.ceil(n / 2)))) * TAA_BAND : 0; // đủ nửa số tín hiệu cùng chiều = nghiêng tối đa
  }
  const mean = TAA_KEYS.reduce((a, k) => a + raw[k], 0) / TAA_KEYS.length;
  const tilt = Object.fromEntries(TAA_KEYS.map((k) => [k, Math.round(raw[k] - mean)]));
  const taa = applyTilt(o.w, tilt, bd);
  return { p, saa: o.w, taa, tilt, score, sig, c: o.cme, before: taaStats(o.w, o.cme), after: taaStats(taa, o.cme) };
}

/** Mức nghiêng đang áp dụng cho khẩu vị `k` (null nếu chưa áp dụng). Dùng trong targetMix(). */
const activeTilt = (k) => (S.settings.tilt && S.settings.tilt.profile === k ? S.settings.tilt.t : null);

let taaAt = null; // thời điểm bấm "Phân tích lại toàn bộ" gần nhất (trong phiên)
function renderTAA(st) {
  const box = $("#taaBox");
  if (!box) return;
  const cur = currentMix(st), total = Object.values(cur).reduce((a, b) => a + b, 0);
  const r = taaCompute(total), applied = S.settings.tilt;
  const curW = { liquid: cur.cash + cur.dep, bond: cur.bond, equity: cur.equity, gold: cur.gold, sat: cur.sat };
  const dirTxt = { 1: ["Thuận", "ok"], 0: ["Trung tính", "warn"], "-1": ["Nghịch", "alert"] };
  const pp = (v) => nf(v, 0) + "%", sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + nf(Math.abs(v), 0);
  const months = Math.max(1, S.settings.dcaMonths || 12);
  const rows = [...TAA_KEYS, "sat"].map((k) => {
    const t = Math.round(r.taa[k] - r.saa[k]), money0 = (total * (r.taa[k] / 100)) - curW[k];
    const sg = r.sig[k] || [];
    return `<tr><td>${LABEL[k]}</td><td>${pp(curW[k] / total * 100)}</td><td>${pp(r.saa[k])}</td>
      <td>${sg.length ? `<span class="chip ${r.score[k] > 0 ? "ok" : r.score[k] < 0 ? "alert" : "warn"}">${r.score[k] >= 0 ? "+" : ""}${r.score[k]}</span> <span class="muted small">/ ${sg.length}</span>` : '<span class="muted small">không nghiêng</span>'}</td>
      <td>${t ? chg(t, sgn(t)) : '<span class="muted">0</span>'}</td><td><b>${pp(r.taa[k])}</b></td>
      <td>${Math.abs(money0) < 1 ? '<span class="muted">—</span>' : `${chg(money0, money(Math.abs(money0)))}<br><span class="muted small">≈ ${money(Math.abs(money0) / months)}/tháng</span>`}</td></tr>`;
  }).join("");
  const sigList = TAA_KEYS.map((k) => `<details class="gvsec" data-k="taa.${k}"><summary>${LABEL[k]}: ${r.sig[k].length} tín hiệu, tổng ${r.score[k] >= 0 ? "+" : ""}${r.score[k]}</summary>
    <div class="tablewrap"><table><tr><th>Tín hiệu</th><th>Hiện tại</th><th>Chiều</th><th class="tip">Ý nghĩa</th></tr>
    ${r.sig[k].map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.value)}</td><td><span class="chip ${dirTxt[x.dir][1]}">${dirTxt[x.dir][0]}</span></td><td class="tip">${esc(x.why)}</td></tr>`).join("")}</table></div></details>`).join("");
  const same = applied && TAA_KEYS.every((k) => (applied.t[k] || 0) === r.tilt[k]);
  const age = applied ? Math.round(daysBetween(applied.at, today())) : 0;
  const status = !applied ? `<span class="chip warn">Chưa áp dụng</span> Mục tiêu hiện tại = phân bổ chiến lược (SAA).`
    : `<span class="chip ok">Đang áp dụng</span> từ ${fmtDate(applied.at)} (${TAA_KEYS.map((k) => `${LABEL[k]} ${sgn(applied.t[k] || 0)}`).join(" · ")})`
      + (applied.profile !== r.p.profile ? ` <span class="warn">cho khẩu vị khác, không có tác dụng với khẩu vị đang chọn.</span>` : "")
      + (same ? "" : ` <span class="warn">Tín hiệu hiện tại đề xuất mức khác.</span>`)
      + (age >= TAA_REVIEW ? ` <span class="warn">Đã ${age} ngày, nên phân tích lại.</span>` : "");
  const dEr = r.after.er - r.before.er, dSd = r.after.sd - r.before.sd;
  box.innerHTML = `
    <p class="small">${status}</p>
    <div class="tablewrap"><table class="taa"><tr><th>Lớp tài sản</th><th>Hiện tại</th><th>SAA</th><th>Tín hiệu</th><th>Nghiêng</th><th>TAA</th><th>Cần chuyển</th></tr>${rows}</table></div>
    <p class="advice">Theo CME hiện tại: lợi nhuận kỳ vọng ${nf(r.before.er, 2)}% → <b>${nf(r.after.er, 2)}%</b>/năm (${chg(dEr, nf(Math.abs(dEr), 2) + " điểm")}),
      độ biến động ${nf(r.before.sd, 1)}% → <b>${nf(r.after.sd, 1)}%</b> (${dSd >= 0 ? "+" : "−"}${nf(Math.abs(dSd), 1)} điểm).
      ${TAA_KEYS.every((k) => !r.tilt[k]) ? "Tín hiệu chưa đủ mạnh để lệch khỏi SAA." : "Chuyển dần trong " + months + " tháng như lộ trình giải ngân; vàng giảm theo lịch bán."}</p>
    <div class="row wrap gap">
      <button type="button" id="taaApply"${TAA_KEYS.every((k) => !r.tilt[k]) || same ? " disabled" : ""}>Áp dụng điều chỉnh</button>
      <button type="button" class="ghost" id="taaClear"${applied ? "" : " hidden"}>Bỏ điều chỉnh, về SAA</button>
      <span class="muted small">${taaAt ? `Phân tích lúc ${taaAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} với dữ liệu mới nhất.` : ""}</span>
    </div>
    <h3 class="sub">Tín hiệu theo lớp tài sản</h3>${sigList}
    <p class="muted small">Mỗi tín hiệu +1 (thuận) / −1 (nghịch) / 0; đủ nửa số tín hiệu của một lớp cùng chiều thì nghiêng tối đa ±${TAA_BAND} điểm %. Tổng mức nghiêng bằng 0 (lớp này tăng thì lớp khác giảm), phần dư vào tiền mặt + tiết kiệm; vẫn giữ ràng buộc vàng ${r.p.goldMin}–${r.p.goldMax}%, cổ phiếu ≤ ${r.p.eqMax}%, quỹ khẩn cấp ${money(r.p.emergency)}. Vệ tinh không nghiêng (CFA giả định alpha = 0). VN-Index/MA200 và rủi ro suy thoái đã nằm trong CME của SAA nên không tính lại cho cổ phiếu. TAA là điều chỉnh ngắn hạn (thường 3–6 tháng) dựa trên quy tắc, không phải dự báo; xem lại khi tín hiệu đổi chiều.</p>`;
  $("#taaApply").onclick = () => { S.settings.tilt = { at: today(), profile: r.p.profile, t: r.tilt }; save(); render(); };
  $("#taaClear").onclick = () => { delete S.settings.tilt; save(); render(); };
}

/** Nút "Phân tích lại toàn bộ": tải lại giá vàng, vĩ mô, quỹ (máy chủ cập nhật 4 lần/ngày; SJC trực tiếp), tính lại mọi phân tích và TAA. */
async function reanalyzeAll() {
  const b = $("#taaRun");
  b.disabled = true; b.textContent = "Đang tải dữ liệu mới…";
  try {
    await Promise.all([loadPrices(), loadMacro()]);
    goldVNKey = null; simKey = ""; profileCardKey = ""; // buộc tính lại cả khi dữ liệu không đổi
    taaAt = new Date();
    renderMacroStatic(); render();
    b.textContent = "✓ Đã phân tích lại";
  } catch (e) { b.textContent = "Lỗi, thử lại"; console.error(e); }
  setTimeout(() => { b.disabled = false; b.textContent = "↻ Phân tích lại toàn bộ"; }, 2500);
}
document.getElementById("taaRun")?.addEventListener("click", reanalyzeAll);
