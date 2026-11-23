"use strict";
/* Heparin IV dosing logic — JavaScript port of scripts/heparin/heparin.ts + protocols.ts (heparin-web-app, React/TS).
   Same protocols, bands, caps, rounding and texts. Parity with the TypeScript originals: scripts/heparin/parity.py. */
const HEP = (() => {
  const round1 = (n) => Math.round(n * 10) / 10;

  /* ── aPTT adjustment band sets ── */
  /** VTE — target aPTT 60–100 sec. from inclusive, to exclusive. */
  const VTE_BANDS = [
    { from: 0, to: 40, bolusPerKg: 80, bolusMaxIu: null, ratePerKg: 4, holdOneHour: false, noChange: false },
    { from: 40, to: 60, bolusPerKg: 40, bolusMaxIu: null, ratePerKg: 2, holdOneHour: false, noChange: false },
    { from: 60, to: 101, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: 0, holdOneHour: false, noChange: true },
    { from: 101, to: 121, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: -2, holdOneHour: false, noChange: false },
    { from: 121, to: Infinity, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: -4, holdOneHour: true, noChange: false },
  ];
  /** Cardiac (STEMI/NSTEMI) — target aPTT 50–70 sec. Bands adapted from standard protocol with shifted therapeutic window
      (comment from the original app); adjustment boluses smaller and capped. */
  const CARDIAC_BANDS = [
    { from: 0, to: 40, bolusPerKg: 40, bolusMaxIu: 4000, ratePerKg: 4, holdOneHour: false, noChange: false },
    { from: 40, to: 50, bolusPerKg: 20, bolusMaxIu: 2000, ratePerKg: 2, holdOneHour: false, noChange: false },
    { from: 50, to: 71, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: 0, holdOneHour: false, noChange: true },
    { from: 71, to: 91, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: -2, holdOneHour: false, noChange: false },
    { from: 91, to: Infinity, bolusPerKg: 0, bolusMaxIu: null, ratePerKg: -4, holdOneHour: true, noChange: false },
  ];

  const CIT = "Dager WE. Table 3-5. ASHP Anticoagulation Therapy, 2018.";
  const PROTOCOLS = [
    { id: "vte", name: "VTE Treatment (DVT/PE)", shortName: "VTE (DVT/PE)", calculable: true, monitoring: "aPTT",
      bolusPerKg: 80, bolusMaxIu: null, infusionPerKgHr: 18, infusionMaxIuPerHr: null, targetAPTT: { low: 60, high: 100 }, apttBands: VTE_BANDS,
      notes: "Standard weight-based heparin for VTE. Lower bolus doses (e.g. 2,000 IU) have been suggested as an option.", citation: CIT },
    { id: "stemi_rtpa", name: "Acute STEMI (full-dose rt-PA)", shortName: "STEMI + rt-PA", calculable: true, monitoring: "aPTT",
      bolusPerKg: 60, bolusMaxIu: 4000, infusionPerKgHr: 12, infusionMaxIuPerHr: 1000, targetAPTT: { low: 50, high: 70 }, apttBands: CARDIAC_BANDS,
      notes: "For full-dose rt-PA. Continue ≥48 hr or until revascularization. aPTT target 50–70 sec. Max bolus 4,000 IU; max infusion 1,000 IU/hr.", citation: CIT },
    { id: "stemi_combo_rtpa", name: "Acute STEMI (combination rt-PA)", shortName: "STEMI combo rt-PA", calculable: true, monitoring: "aPTT",
      bolusPerKg: 60, bolusMaxIu: 3000, infusionPerKgHr: 7, infusionMaxIuPerHr: 800, targetAPTT: { low: 50, high: 70 }, apttBands: CARDIAC_BANDS,
      notes: "Combination rt-PA regimen — lower caps apply. Max bolus 3,000 IU; max infusion 800 IU/hr. See Chapter 6.", citation: CIT },
    { id: "nstemi_ua", name: "NSTEMI / Unstable Angina", shortName: "NSTEMI / UA", calculable: true, monitoring: "aPTT",
      bolusPerKg: 60, bolusMaxIu: 4000, infusionPerKgHr: 12, infusionMaxIuPerHr: 1000, targetAPTT: { low: 50, high: 70 }, apttBands: CARDIAC_BANDS,
      notes: "Continue 48 hr or until revascularization. Some institutions use a higher initial threshold to reach the target range faster.", citation: CIT },
    { id: "pci_with_gp", name: "PCI (with GP IIb/IIIa inhibitor)", shortName: "PCI + GP IIb/IIIa", calculable: false, monitoring: "ACT",
      bolusPerKg: null, bolusMaxIu: null, infusionPerKgHr: null, infusionMaxIuPerHr: null, targetAPTT: null, apttBands: null,
      bolusRangeLabel: "50–70 IU/kg IV", actTargetLabel: "200–250 sec (low response ACT)",
      notes: "Monitored by ACT — not aPTT. Additional bolus doses may be needed to maintain target ACT. aPTT-based adjustment is not applicable for this indication.", citation: CIT },
    { id: "pci_without_gp", name: "PCI (without GP IIb/IIIa inhibitor)", shortName: "PCI only", calculable: false, monitoring: "ACT",
      bolusPerKg: null, bolusMaxIu: null, infusionPerKgHr: null, infusionMaxIuPerHr: null, targetAPTT: null, apttBands: null,
      bolusRangeLabel: "70–100 IU/kg IV", actTargetLabel: "Varies by device/card range — see Table 3-9",
      notes: "ACT target depends on the device and card range used. Different systems (Hemochron, MedTronic, HemoTec) give notably different values. aPTT-based adjustment is not applicable.", citation: CIT },
  ];
  const DEFAULT_PROTOCOL_ID = "vte";
  const getProtocol = (id) => PROTOCOLS.find((p) => p.id === id) ?? PROTOCOLS[0];

  /** Initial bolus and infusion rate; applies max caps where defined (e.g. STEMI protocols). */
  function calcInitialDose(weightKg, protocol, concentrationIuPerMl = 250) {
    const rawBolusIu = weightKg * protocol.bolusPerKg;
    const bolusIu = protocol.bolusMaxIu !== null ? Math.min(rawBolusIu, protocol.bolusMaxIu) : rawBolusIu;
    const bolusCapped = protocol.bolusMaxIu !== null && rawBolusIu > protocol.bolusMaxIu;
    const rawInfusionIuPerHr = weightKg * protocol.infusionPerKgHr;
    const infusionIuPerHr = protocol.infusionMaxIuPerHr !== null ? Math.min(rawInfusionIuPerHr, protocol.infusionMaxIuPerHr) : rawInfusionIuPerHr;
    const infusionCapped = protocol.infusionMaxIuPerHr !== null && rawInfusionIuPerHr > protocol.infusionMaxIuPerHr;
    return {
      bolus: { iu: bolusIu, mL: round1(bolusIu / concentrationIuPerMl) },
      infusion: { iuPerHr: infusionIuPerHr, mLPerHr: round1(infusionIuPerHr / concentrationIuPerMl) },
      bolusCapped, infusionCapped,
    };
  }

  /** aPTT-guided adjustment using protocol-specific bands; rate clamped to a minimum of 0 IU/hr. */
  function calcAPTTAdjustment(aptt, weightKg, currentRateIuPerHr, bands, concentrationIuPerMl = 250) {
    const band = bands.find((b) => aptt >= b.from && aptt < b.to);
    if (!band) throw new Error(`No aPTT band matched for value ${aptt}`);
    let bolusIu = null;
    if (band.bolusPerKg > 0) {
      bolusIu = weightKg * band.bolusPerKg;
      if (band.bolusMaxIu !== null) bolusIu = Math.min(bolusIu, band.bolusMaxIu);
    }
    const newRateIuPerHr = Math.max(0, currentRateIuPerHr + weightKg * band.ratePerKg);
    return {
      aptt,
      bolusSurcharge: bolusIu !== null ? { iu: bolusIu, mL: round1(bolusIu / concentrationIuPerMl) } : null,
      holdOneHour: band.holdOneHour,
      newRateIuPerHr,
      newRateMlPerHr: round1(newRateIuPerHr / concentrationIuPerMl),
      noChange: band.noChange,
    };
  }

  /** Band range as text, e.g. "60–100". */
  function formatBandRange(band) {
    if (band.from === 0) return `< ${band.to}`;
    if (band.to === Infinity) return `> ${band.from - 1}`;
    return `${band.from}–${band.to - 1}`;
  }

  const REFERENCES = [
    [1, "Anticoagulation Therapy: A Clinical Practice Guide (2nd ed.) — Table 3-5: Dosing Considerations for the Initiation of UFH", "Dager WE, Gulseth MP, Nutescu EA. American Society of Health-System Pharmacists (ASHP)", 2018, "https://store.ashp.org/Default.aspx?TabID=251&productId=617828848"],
    [2, "Evidence-based management of anticoagulant therapy: antithrombotic therapy and prevention of thrombosis, 9th ed: American College of Chest Physicians evidence-based clinical practice guidelines", "Chest", 2012, "https://pubmed.ncbi.nlm.nih.gov/22315259/"],
    [3, "Cancer-associated venous thromboembolic disease, version 2.2024, NCCN clinical practice guidelines in oncology", "Journal of the National Comprehensive Cancer Network", 2024, "https://pubmed.ncbi.nlm.nih.gov/39236759/"],
    [4, "Unfractionated Heparin Dosing and Monitoring Protocol for Therapeutic Anticoagulation", "Praxis Medical Insights: Practical Summaries of Clinical Guidelines", 2025, "https://droracle.ai/guidelines/118395cd-319a-4f9b-a33d-e920aa3dd61c"],
    [5, "Heparin Protocol for Therapeutic Anticoagulation", "Praxis Medical Insights: Practical Summaries of Clinical Guidelines", 2025, "https://droracle.ai/guidelines/8ef9170b-4910-4ed9-9503-4fc218f95443"],
    [6, "Official FDA Drug Label for Heparin (IV)", "FDA / DailyMed", 2025, "https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=239b4816-6a55-451b-bf40-e611be07d12f"],
    [7, "Comparison of 2 weight-based heparin dosing nomograms in neurology and vascular surgical patients", "Therapeutic Drug Monitoring", 2015, "https://pubmed.ncbi.nlm.nih.gov/24831654/"],
    [8, "ESC guidelines for the management of acute myocardial infarction in patients presenting with ST-segment elevation", "European Heart Journal", 2012, "https://pubmed.ncbi.nlm.nih.gov/22922416/"],
    [9, "Unfractionated heparin dosing for venous thromboembolism in morbidly obese patients: case report and review of the literature", "Pharmacotherapy", 2010, "https://pubmed.ncbi.nlm.nih.gov/20180615/"],
    [10, "Use of a modified dosing weight for heparin therapy in a morbidly obese patient", "The Annals of Pharmacotherapy", 2005, "https://pubmed.ncbi.nlm.nih.gov/15741422/"],
    [11, "Heparin kinetics in venous thrombosis and pulmonary embolism", "Circulation", 1976, "https://pubmed.ncbi.nlm.nih.gov/1253392/"],
    [12, "Part 9: Acute coronary syndromes: 2015 American Heart Association guidelines update for cardiopulmonary resuscitation and emergency cardiovascular care", "Circulation", 2015, "https://pubmed.ncbi.nlm.nih.gov/26472997/"],
  ].map(([n, title, source, year, url]) => ({ n, title, source, year, url }));

  return { PROTOCOLS, DEFAULT_PROTOCOL_ID, getProtocol, calcInitialDose, calcAPTTAdjustment, formatBandRange, REFERENCES };
})();
