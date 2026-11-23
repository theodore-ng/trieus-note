"use strict";
/* PAD Classification UI: reads the forms, calls PAD (classification.js) and renders results live.
   Field mapping follows the original app.py. Active tab is kept in the URL hash (#fontaine, #rutherford, #wifi). */
(() => {
  const $ = (s) => document.querySelector(s);
  const num = (f, n) => { const v = f[n].value.trim(); if (!v) return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const radio = (f, n) => f.querySelector(`input[name="${n}"]:checked`)?.value || "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const list = (title, items, cls) => (items.length ? `<div class="${cls}"><p>${title}</p><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
  const card = (badge, lvl, title, body) => `<div class="padcard"><div class="padhead"><span class="stage ${lvl}">${badge}</span><h3>${title}</h3></div>${body}</div>`;

  // show/hide dependent fields (data-show="<checkbox name>")
  function deps(f) { f.querySelectorAll("[data-show]").forEach((el) => (el.hidden = !f[el.dataset.show].checked)); }

  function fontaine() {
    const f = $("#fForm");
    const r = PAD.classifyFontaine({ abi: num(f, "abi"), hasClaudication: f.claud.checked, walkingDistanceM: num(f, "dist"), hasRestPain: f.rest.checked, hasTissueLoss: f.tissue.checked });
    const lvl = { I: "low", IIa: "mild", IIb: "mild", III: "mod", IV: "high" }[r.stage];
    $("#fRes").innerHTML = card(`Stage ${r.stage}`, lvl, "Fontaine classification",
      `<p class="desc">${esc(r.description)}</p><p class="crit"><b>Criteria met:</b> ${esc(r.criteria_met)}</p>${list("Clinical notes / warnings", r.warnings, "warns")}`);
  }

  function rutherford() {
    const f = $("#rForm"), tread = radio(f, "tread"), tm = radio(f, "tm");
    const r = PAD.classifyRutherford({
      hasTissueLoss: f.tissue.checked,
      tissueLossAboveTm: f.tissue.checked ? (tm === "above" ? true : tm === "below" ? false : null) : null,
      hasRestPain: f.rest.checked, restingApMmhg: num(f, "rap"), toePressureMmhg: num(f, "tp"),
      hasClaudication: f.claud.checked, completesTreadmill: tread === "yes" ? true : tread === "no" ? false : null,
      postExerciseApMmhg: num(f, "post"), restingApForClaudication: num(f, "rap"),
    });
    const lvl = r.category === 0 ? "low" : r.category <= 2 ? "mild" : r.category === 3 ? "mod" : "high";
    $("#rRes").innerHTML = card(`Grade ${r.grade} / Cat ${r.category}`, lvl, "Rutherford classification",
      `<p class="desc">${esc(r.description)}</p><p class="crit"><b>Criteria met:</b> ${esc(r.criteria_met)}</p>${list("Clinical notes / warnings", r.warnings, "warns")}`);
  }

  function wifi() {
    const f = $("#wForm"), m = { abi: num(f, "abi"), anklePressureMmhg: num(f, "ap"), toePressureMmhg: num(f, "tp"), tcpo2Mmhg: num(f, "tc") };
    if (Object.values(m).every((v) => v == null)) {
      $("#wRes").innerHTML = '<p class="warn small">Please enter at least one ischemia measure (ABI, ankle pressure, toe pressure, or TcPO₂).</p>';
      return;
    }
    const w = +radio(f, "w"), fi = +radio(f, "fi"), i = PAD.scoreWifiIschemia(m), r = PAD.classifyWifi({ w, i, fi });
    const entered = [m.abi != null && `ABI ${PAD.fx(m.abi, 2)}`, m.anklePressureMmhg != null && `AP ${PAD.fx(m.anklePressureMmhg, 0)} mmHg`,
      m.toePressureMmhg != null && `TP ${PAD.fx(m.toePressureMmhg, 0)} mmHg`, m.tcpo2Mmhg != null && `TcPO₂ ${PAD.fx(m.tcpo2Mmhg, 0)} mmHg`].filter(Boolean);
    const lvl = { 1: "low", 2: "mild", 3: "mod", 4: "high" }[r.clinical_stage];
    $("#wRes").innerHTML = card(`Stage ${r.clinical_stage}`, lvl, "WIfI classification",
      `<div class="chips"><span>W = ${w}</span><span>I = ${i}</span><span>fI = ${fi}</span></div>
       <p class="desc"><b>Amputation risk:</b> ${esc(r.amp_risk_description)}</p>
       <p class="desc"><b>Revascularization benefit:</b> ${esc(r.revasc_benefit_description)}</p>
       <p class="crit"><b>W=${w}:</b> ${esc(PAD.W_DESC[w])}<br><b>I=${i}:</b> ${esc(PAD.I_DESC[i])}${entered.length > 1 ? `<br><small class="muted">Entered: ${esc(entered.join(", "))}; most severe measure used</small>` : ""}<br><b>fI=${fi}:</b> ${esc(PAD.FI_DESC[fi])}</p>
       ${list("Contextual notes", r.notes, "notes")}`);
  }

  const RUN = { fForm: fontaine, rForm: rutherford, wForm: wifi };
  for (const [id, fn] of Object.entries(RUN)) {
    const f = document.getElementById(id);
    const go = () => { deps(f); fn(); };
    f.addEventListener("input", go);
    f.addEventListener("change", go);
    go();
  }

  // Tabs
  const ids = ["fontaine", "rutherford", "wifi"];
  function show(id) {
    if (!ids.includes(id)) id = ids[0];
    document.querySelectorAll(".padp").forEach((s) => (s.hidden = s.dataset.p !== id));
    document.querySelectorAll(".subnav button").forEach((b) => b.classList.toggle("on", b.dataset.p === id));
  }
  document.querySelector(".subnav").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]");
    if (b) { history.replaceState(null, "", "#" + b.dataset.p); show(b.dataset.p); }
  });
  addEventListener("hashchange", () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();
