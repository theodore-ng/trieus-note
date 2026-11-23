"use strict";
/* Heparin IV Calc UI — port of App.tsx and components of heparin-web-app (same flow, texts and order formats).
   State resets follow the original: changing indication / weight / mode / regimen clears results. */
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const loc = (n) => Number(n).toLocaleString("en-US");

  const HOW_TO_USE_CALCULABLE = [
    "Select the clinical indication.",
    "Enter the patient's weight in kg.",
    'Choose "Calc Initial Dose" for a new order, or "Adjust Dose" to update an existing infusion.',
    "Enter the heparin regimen: total IU in the bag and the diluent volume in mL.",
    "For initial dose: administer bolus and start infusion. Recheck aPTT in 6 hours.",
    'For dose adjustment: enter the current infusion rate and latest aPTT, then click "Adjust Dose". Repeat each time a new aPTT is drawn.',
  ];
  const HOW_TO_USE_ACT = [
    "Select the PCI indication.",
    "Enter the patient's weight in kg to see the bolus dose range.",
    "Administer bolus IV push and verify ACT response per institutional protocol.",
    "Additional bolus doses may be given to maintain target ACT.",
    "aPTT monitoring is not applicable for this indication.",
  ];

  const st = { protocolId: HEP.DEFAULT_PROTOCOL_ID, mode: null, initialDose: null, adjustment: null, prevRate: null };
  const proto = () => HEP.getProtocol(st.protocolId);
  const weightKg = () => parseFloat($("#weight").value);
  const weightValid = () => !isNaN(weightKg()) && weightKg() > 0;
  const regimen = () => {
    const iu = parseFloat($("#regIu").value), ml = parseFloat($("#regMl").value);
    const valid = !isNaN(iu) && iu > 0 && !isNaN(ml) && ml > 0;
    return { iu, ml, valid, conc: valid ? iu / ml : 250 };
  };
  const clear = () => { st.initialDose = null; st.adjustment = null; st.prevRate = null; };

  /* ---------- copy (clipboard with fallback for non-secure contexts) ---------- */
  function copy(text, btn) {
    const done = () => { btn.textContent = "✓ Copied"; setTimeout(() => (btn.textContent = "Copy Orders"), 2000); };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* bỏ qua */ }
      ta.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => { fallback(); done(); });
    else { fallback(); done(); }
  }

  /* ---------- render ---------- */
  function renderProtocols() {
    $("#protos").innerHTML = HEP.PROTOCOLS.map((p) => `<button type="button" data-id="${p.id}" title="${esc(p.name)}" class="${p.id === st.protocolId ? "on" : ""}${p.calculable ? "" : " act"}">${esc(p.shortName)}${p.calculable ? "" : ' <span class="acttag">ACT</span>'}</button>`).join("");
  }

  function renderGuide() {
    const p = proto(), calc = p.calculable;
    const li = (a, b) => `<li><span>${a}</span><b>${b}</b></li>`;
    const overview = calc
      ? li("Bolus", `${p.bolusPerKg} IU/kg${p.bolusMaxIu ? ` <small>(max ${loc(p.bolusMaxIu)} IU)</small>` : ""}`)
        + li("Infusion", `${p.infusionPerKgHr} IU/kg/hr${p.infusionMaxIuPerHr ? ` <small>(max ${loc(p.infusionMaxIuPerHr)} IU/hr)</small>` : ""}`)
        + li("Target aPTT", `${p.targetAPTT.low}–${p.targetAPTT.high} sec`) + li("Recheck aPTT", "6 hr after change")
      : li("Bolus", esc(p.bolusRangeLabel)) + li("Monitoring", "ACT (not aPTT)") + li("ACT Target", esc(p.actTargetLabel));
    const bandCls = (b) => (b.noChange ? "ok" : b.holdOneHour || b.from === 0 ? "hi" : "mid");
    const table = calc && p.apttBands ? `<section class="card"><h2>aPTT adjustment table</h2><p class="muted small">Target: ${p.targetAPTT.low}–${p.targetAPTT.high} sec</p>
      <table class="hepband"><tr><th>aPTT (sec)</th><th>Bolus</th><th>Rate Δ</th></tr>${p.apttBands.map((b) => {
        const bolus = b.bolusPerKg > 0 ? `${b.bolusPerKg} IU/kg${b.bolusMaxIu ? ` (max ${loc(b.bolusMaxIu)})` : ""}` : "—";
        const rate = b.noChange ? "No change" : b.holdOneHour ? `Hold 1 hr,<br>−${Math.abs(b.ratePerKg)} IU/kg/hr` : b.ratePerKg > 0 ? `+${b.ratePerKg} IU/kg/hr` : `−${Math.abs(b.ratePerKg)} IU/kg/hr`;
        return `<tr class="${bandCls(b)}"><td>${HEP.formatBandRange(b)}</td><td>${bolus}</td><td>${rate}</td></tr>`;
      }).join("")}</table></section>` : "";
    const act = p.monitoring === "ACT" ? `<section class="card"><h2>ACT monitoring</h2><ul class="hepul">
      <li>ACT is measured at the bedside during/after PCI.</li><li>Target and repeat bolus dose depends on the ACT device and card range used.</li>
      <li>aPTT-guided adjustment does not apply to PCI indications.</li><li>Refer to Table 3-9 (Dager 2018) for device-specific ACT ranges.</li></ul></section>` : "";
    $("#guide").innerHTML = `
      <section class="card"><h2>Protocol overview ${p.monitoring === "ACT" ? '<span class="acttag">ACT</span>' : ""}</h2><ul class="hepkv">${overview}</ul>${p.notes ? `<p class="muted small">${esc(p.notes)}</p>` : ""}</section>
      ${table}${act}
      <section class="card"><h2>Safety notes</h2><ul class="hepul">
        <li>Verify all doses clinically before administration.</li><li>Institutional protocol overrides this calculator.</li>
        <li>Minimum infusion rate is 0 mL/hr — never run negative.</li><li>All mL values are rounded to 1 decimal place.</li>
        ${calc ? `<li>For aPTT &gt;${p.apttBands.find((b) => b.holdOneHour).from - 1} sec, hold infusion for 1 hour before resuming.</li>` : ""}</ul></section>
      <details class="card heprefs"><summary>References <span class="muted small">${HEP.REFERENCES.length} sources</span></summary><ol>
        ${HEP.REFERENCES.map((r) => `<li>${esc(r.title)}. <span class="muted">${esc(r.source)}, ${r.year}.</span> <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a></li>`).join("")}</ol></details>`;
  }

  function renderActInfo() {
    const p = proto(), box = $("#actInfo");
    box.hidden = p.calculable;
    if (p.calculable) return;
    const w = weightKg(), has = !isNaN(w) && w > 0;
    const range = p.id === "pci_with_gp" ? `${loc(50 * w)}–${loc(70 * w)} IU` : `${loc(70 * w)}–${loc(100 * w)} IU`;
    box.innerHTML = `<h2><span class="acttag">ACT-monitored</span> ${esc(p.name)}</h2>
      <div class="hepbig"><small>Bolus dose</small>${has ? `<b>${range}</b><span>${esc(p.bolusRangeLabel)}</span>` : `<b>${esc(p.bolusRangeLabel)}</b><span>Enter patient weight above for the computed dose range</span>`}</div>
      <ul class="hepkv"><li><span>Monitoring</span><b>ACT (not aPTT)</b></li><li><span>ACT Target</span><b>${esc(p.actTargetLabel)}</b></li><li><span>Concentration</span><b>250 IU/mL</b></li></ul>
      <p class="small"><b>Clinical notes</b><br>${esc(p.notes)}</p><p class="muted small">${esc(p.citation)}</p>`;
  }

  function renderInitial() {
    const p = proto(), d = st.initialDose, r = regimen(), w = weightKg(), box = $("#initOut");
    box.hidden = !(st.mode === "initial" && r.valid && d);
    if (box.hidden) return;
    const order = [
      `HEPARIN IV ORDER — ${p.shortName} | Weight: ${w} kg`,
      `Concentration: ${loc(r.iu)} IU in ${r.ml} mL (${r.conc.toFixed(1)} IU/mL)`,
      ``,
      `INITIAL BOLUS: ${loc(d.bolus.iu)} IU (${d.bolus.mL} mL) IV push${d.bolusCapped ? ` [capped at ${loc(p.bolusMaxIu)} IU]` : ""}`,
      `INITIAL INFUSION: ${loc(d.infusion.iuPerHr)} IU/hr (${d.infusion.mLPerHr} mL/hr)${d.infusionCapped ? ` [capped at ${loc(p.infusionMaxIuPerHr)} IU/hr]` : ""}`,
      ``,
      `aPTT target: ${p.targetAPTT.low}–${p.targetAPTT.high} sec`,
      `Recheck aPTT in 6 hours.`,
      `VERIFY DOSE CLINICALLY BEFORE ADMINISTRATION.`,
    ].join("\n");
    box.innerHTML = `<div class="hephead"><h2>Initial dose</h2><button type="button" class="ghost" data-copy>Copy Orders</button></div>
      <div class="hepres">
        <div class="hepbig"><small>Initial bolus</small><b>${loc(d.bolus.iu)} IU</b><span>${d.bolus.mL} mL IV push</span>${d.bolusCapped ? `<em>Max cap: ${loc(p.bolusMaxIu)} IU</em>` : ""}</div>
        <div class="hepbig"><small>Initial infusion</small><b>${loc(d.infusion.iuPerHr)} IU/hr</b><span>${d.infusion.mLPerHr} mL/hr</span>${d.infusionCapped ? `<em>Max cap: ${loc(p.infusionMaxIuPerHr)} IU/hr</em>` : ""}</div>
      </div>
      <p class="hepalert">⚠ Verify dose clinically before administration. Recheck aPTT in 6 hours.</p>`;
    box.querySelector("[data-copy]").onclick = (e) => copy(order, e.currentTarget);
  }

  function renderAdjustOut() {
    const a = st.adjustment, prev = st.prevRate, w = weightKg(), box = $("#adjOut");
    box.hidden = !(a && prev !== null);
    if (box.hidden) return;
    const lines = [`HEPARIN ADJUSTMENT — Weight: ${w} kg | aPTT: ${a.aptt} sec`, `Previous rate: ${prev} IU/hr`, ``];
    if (a.noChange) lines.push(`aPTT in target range. No dose change required.`);
    else {
      if (a.bolusSurcharge) lines.push(`BOLUS: ${a.bolusSurcharge.iu} IU (${a.bolusSurcharge.mL} mL) IV push`);
      if (a.holdOneHour) lines.push(`HOLD INFUSION FOR 1 HOUR, then resume at new rate.`);
      lines.push(`NEW INFUSION RATE: ${a.newRateIuPerHr} IU/hr (${a.newRateMlPerHr} mL/hr)`);
    }
    lines.push(``, `Recheck aPTT in 6 hours.`, `VERIFY DOSE CLINICALLY BEFORE ADMINISTRATION.`);
    box.innerHTML = `<div class="hephead"><h2>Adjustment result</h2><button type="button" class="ghost" data-copy>Copy Orders</button></div>
      ${a.holdOneHour ? '<p class="hepstop">🛑 HOLD infusion for 1 hour, then resume at new rate below.</p>' : ""}
      ${a.noChange
        ? `<div class="hepbig ok"><small>aPTT in therapeutic range</small><b>No change required</b><span>Current rate: ${loc(prev)} IU/hr</span></div>`
        : `<div class="hepres">${a.bolusSurcharge ? `<div class="hepbig"><small>Additional bolus</small><b>${loc(a.bolusSurcharge.iu)} IU</b><span>${a.bolusSurcharge.mL} mL IV push</span></div>` : ""}
           <div class="hepbig"><small>New infusion rate</small><b>${loc(a.newRateIuPerHr)} IU/hr</b><span>${a.newRateMlPerHr} mL/hr</span>${a.newRateIuPerHr === 0 ? "<em>Rate clamped to minimum (0)</em>" : ""}</div></div>`}
      <p class="hepalert">⚠ Verify dose clinically before administration. Recheck aPTT in 6 hours.</p>`;
    box.querySelector("[data-copy]").onclick = (e) => copy(lines.join("\n"), e.currentTarget);
  }

  function render() {
    const p = proto(), r = regimen(), wv = weightValid();
    renderProtocols();
    $("#howTo").innerHTML = (p.calculable ? HOW_TO_USE_CALCULABLE : HOW_TO_USE_ACT).map((s) => `<li>${esc(s)}</li>`).join("");
    $("#extremeW").hidden = !(wv && weightKg() > 200);
    $("#modes").hidden = !(wv && p.calculable);
    document.querySelectorAll("#modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.mode));
    renderActInfo();
    $("#regimen").hidden = !(st.mode !== null && p.calculable);
    $("#conc").hidden = !r.valid;
    if (r.valid) $("#conc").innerHTML = `Concentration: <b>${r.conc.toFixed(1)} IU/mL</b> (${loc(r.iu)} IU in ${esc($("#regMl").value)} mL)`;
    $("#btnInitial").hidden = st.mode !== "initial";
    $("#btnInitial").disabled = !r.valid;
    renderInitial();
    const showAdj = r.valid && p.calculable && ((st.mode === "initial" && st.initialDose) || st.mode === "adjustment");
    $("#adjust").hidden = !showAdj;
    if (showAdj) {
      const t = p.targetAPTT;
      $("#bandSum").innerHTML = `<b>aPTT target: ${t.low}–${t.high} sec</b>` + p.apttBands.map((b) => {
        const act = b.noChange ? "No change" : b.holdOneHour ? "Hold 1 hr + ↓ rate" : b.ratePerKg > 0 ? `${b.bolusPerKg > 0 ? "Bolus + " : ""}↑ rate` : "↓ rate";
        return `<span>${HEP.formatBandRange(b)} sec → ${act}</span>`;
      }).join("");
    }
    adjValid();
    renderAdjustOut();
    renderGuide();
  }

  function adjValid() {
    const rate = $("#curRate").value, ap = $("#aptt").value;
    const rateOk = rate !== "" && !isNaN(parseFloat(rate)) && parseFloat(rate) >= 0;
    const ok = ap !== "" && !isNaN(parseFloat(ap)) && parseFloat(ap) > 0 && rateOk;
    $("#btnAdjust").disabled = !ok;
    return ok;
  }

  /* ---------- events (resets as in the original) ---------- */
  $("#protos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    st.protocolId = b.dataset.id; st.mode = null; clear();
    $("#curRate").value = ""; $("#aptt").value = "";
    render();
  });
  $("#weight").addEventListener("input", () => { clear(); render(); });
  $("#modes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    st.mode = b.dataset.mode; clear();
    $("#curRate").value = ""; $("#aptt").value = "";
    render();
  });
  for (const id of ["#regIu", "#regMl"]) $(id).addEventListener("input", () => { clear(); render(); });
  $("#btnInitial").onclick = () => {
    const p = proto(), r = regimen();
    if (!weightValid() || !p.calculable || !r.valid) return;
    st.initialDose = HEP.calcInitialDose(weightKg(), p, r.conc);
    st.adjustment = null; st.prevRate = null;
    $("#aptt").value = "";
    $("#curRate").value = String(st.initialDose.infusion.mLPerHr);
    render();
  };
  for (const id of ["#curRate", "#aptt"]) {
    $(id).addEventListener("input", () => { st.adjustment = null; adjValid(); renderAdjustOut(); });
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" && adjValid()) $("#btnAdjust").click(); });
  }
  $("#btnAdjust").onclick = () => {
    const p = proto(), r = regimen(), aptt = parseFloat($("#aptt").value), rate = parseFloat($("#curRate").value) * r.conc;
    if (isNaN(aptt) || !weightValid() || aptt <= 0 || isNaN(rate) || !p.apttBands) return;
    st.prevRate = rate;
    st.adjustment = HEP.calcAPTTAdjustment(aptt, weightKg(), rate, p.apttBands, r.conc);
    renderAdjustOut();
  };
  render();
})();
