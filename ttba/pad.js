"use strict";
/* PAD Classification Logic — JavaScript port of scripts/pad/classification.py (same rules, texts and priorities).
   Sources:
     Fontaine: Fontaine R, Kim M, Kieny R (1954). Rev Chir Orthop.
     Rutherford: Rutherford RB et al. (1986). J Vasc Surg 4(1):80-94.
     WIfI: Mills JL et al. (2014). J Vasc Surg 59(1):220-234.
   Parity with the Python reference is checked by scripts/pad/parity.py. */
const PAD = (() => {
  /** Python-style fixed formatting (f"{x:.Nf}"): exact binary ties round half to even, like Python. */
  function fx(x, d) {
    const s = x * 10 ** d;
    if (Number.isInteger(s * 2) && !Number.isInteger(s)) {
      let n = Math.floor(s);
      if (n % 2 !== 0) n += 1;
      return (n / 10 ** d).toFixed(d);
    }
    return x.toFixed(d);
  }

  // ---------------- Fontaine ----------------
  const FONTAINE = {
    I: "Asymptomatic peripheral arterial disease",
    IIa: "Mild claudication (pain-free walking > 200 m)",
    IIb: "Moderate to severe claudication (pain-free walking ≤ 200 m)",
    III: "Ischemic rest pain",
    IV: "Ulceration or gangrene (tissue loss)",
  };
  const fres = (stage, criteria, warnings) => ({ stage, description: FONTAINE[stage], criteria_met: criteria, warnings });

  function classifyFontaine({ abi, hasClaudication, walkingDistanceM, hasRestPain, hasTissueLoss }) {
    const warnings = [];
    if (abi != null && abi > 1.3) {
      warnings.push("ABI > 1.3 suggests non-compressible vessels (medial calcification). ABI is unreliable; consider toe-brachial index.");
    }
    // Priority hierarchy: IV > III > IIb > IIa > I
    if (hasTissueLoss) return fres("IV", "Ulceration or gangrene present", warnings);
    if (hasRestPain) return fres("III", "Ischemic rest pain present", warnings);
    if (hasClaudication) {
      const dist = walkingDistanceM;
      if (dist == null) {
        warnings.push("Walking distance not provided; cannot distinguish Stage IIa (> 200 m) from Stage IIb (≤ 200 m). Defaulting to IIb (more conservative).");
        return fres("IIb", "Claudication present; walking distance unknown", warnings);
      }
      if (dist <= 200) return fres("IIb", `Claudication with pain-free walking distance ≤ 200 m (${fx(dist, 0)} m reported)`, warnings);
      return fres("IIa", `Claudication with pain-free walking distance > 200 m (${fx(dist, 0)} m reported)`, warnings);
    }
    if (abi == null) {
      warnings.push("ABI not provided. Stage I requires hemodynamic confirmation (ABI < 0.9).");
    } else if (abi >= 0.9 && abi <= 1.3) {
      warnings.push(`ABI ${fx(abi, 2)} is within normal range (≥ 0.9). PAD diagnosis should be reconsidered or confirmed with further testing.`);
    }
    return fres("I", "Asymptomatic; no claudication, rest pain, or tissue loss", warnings);
  }

  // ---------------- Rutherford ----------------
  const RUTH = {
    "0,0": "Asymptomatic — no hemodynamic compromise",
    "1,1": "Mild claudication",
    "1,2": "Moderate claudication",
    "1,3": "Severe claudication",
    "2,4": "Ischemic rest pain",
    "3,5": "Minor tissue loss (non-healing ulcer or focal gangrene with diffuse pedal ischemia)",
    "3,6": "Major tissue loss (extending above transmetatarsal level; functional foot not salvageable)",
  };
  const rres = (grade, category, criteria, warnings) => ({ grade, category, description: RUTH[`${grade},${category}`], criteria_met: criteria, warnings });

  function checkHemodynamicsClti(ap, tp, warnings, category) {
    const [apT, tpT] = { 5: [60, 40], 6: [60, 40] }[category];
    if (ap != null && ap > apT) warnings.push(`Resting ankle pressure ${fx(ap, 0)} mmHg > ${apT} mmHg threshold for Category ${category}.`);
    if (tp != null && tp > tpT) warnings.push(`Toe pressure ${fx(tp, 0)} mmHg > ${tpT} mmHg threshold for Category ${category}.`);
  }

  function classifyRutherford({ hasTissueLoss, tissueLossAboveTm = null, hasRestPain, restingApMmhg = null, toePressureMmhg = null,
    hasClaudication, completesTreadmill = null, postExerciseApMmhg = null, restingApForClaudication = null, treadmillNormal = null }) {
    const warnings = [];
    if (hasTissueLoss) {
      if (tissueLossAboveTm === true) return rres(3, 6, "Tissue loss extending proximal to transmetatarsal level", warnings);
      if (tissueLossAboveTm === false) {
        checkHemodynamicsClti(restingApMmhg, toePressureMmhg, warnings, 5);
        return rres(3, 5, "Tissue loss distal to transmetatarsal level with pedal ischemia", warnings);
      }
      warnings.push("Tissue loss present but extent relative to transmetatarsal level not specified. Category 5 assigned; upgrade to Category 6 if loss is proximal to TM level.");
      checkHemodynamicsClti(restingApMmhg, toePressureMmhg, warnings, 5);
      return rres(3, 5, "Tissue loss (extent unspecified; defaulted to Category 5)", warnings);
    }
    if (hasRestPain) {
      if (restingApMmhg != null && restingApMmhg > 40) {
        warnings.push(`Resting ankle pressure ${fx(restingApMmhg, 0)} mmHg > 40 mmHg. Rutherford Category 4 typically requires AP ≤ 40 mmHg or TP < 30 mmHg.`);
      } else if (restingApMmhg == null && toePressureMmhg == null) {
        warnings.push("No hemodynamic data provided for rest pain staging. Category 4 requires resting AP ≤ 40 mmHg or TP < 30 mmHg for confirmation.");
      }
      return rres(2, 4, "Ischemic rest pain present", warnings);
    }
    if (hasClaudication) {
      if (completesTreadmill == null && postExerciseApMmhg == null) {
        warnings.push("Treadmill exercise testing not performed or data unavailable. Formal Rutherford grading of claudication requires standard treadmill protocol (5 min, 12% grade, 2 mph). Category estimated as 2 (moderate) pending objective testing.");
        return rres(1, 2, "Claudication present; treadmill data unavailable (Category 2 estimated)", warnings);
      }
      const post = postExerciseApMmhg, resting = restingApForClaudication;
      if (completesTreadmill === true) {
        if (post != null && post > 50 && resting != null && resting - post >= 25) {
          return rres(1, 1, `Completes treadmill; post-exercise AP ${fx(post, 0)} mmHg > 50 mmHg and ≥ 25 mmHg drop from resting (${fx(resting, 0)} mmHg)`, warnings);
        }
        warnings.push("Treadmill completed but hemodynamic criteria for Category 1 not fully met. Category 2 assigned.");
        return rres(1, 2, "Completes treadmill; hemodynamic data partially meets Category 2", warnings);
      }
      if (post != null && post < 50) {
        return rres(1, 3, `Does not complete treadmill; post-exercise AP ${fx(post, 0)} mmHg < 50 mmHg`, warnings);
      }
      warnings.push("Does not complete treadmill but post-exercise AP ≥ 50 mmHg or unknown. Category 2 assigned; reassess with full hemodynamic data.");
      return rres(1, 2, "Does not complete treadmill; post-exercise AP ≥ 50 mmHg (moderate claudication)", warnings);
    }
    if (treadmillNormal === false) {
      warnings.push("Asymptomatic selected but treadmill test is abnormal. Consider Category 1 if hemodynamic compromise is confirmed.");
    }
    return rres(0, 0, "Asymptomatic; no claudication, rest pain, or tissue loss", warnings);
  }

  // ---------------- WIfI ----------------
  const W_DESC = {
    0: "No wound / ischemic rest pain only",
    1: "Small shallow ulcer(s) on distal leg/foot; no exposed bone (except IPJ of toe)",
    2: "Deeper ulcer with exposed tendon, capsule, or bone; or shallow heel ulcer",
    3: "Extensive/deep ulcer of forefoot ± midfoot; deep heel ulcer ± calcaneal involvement",
  };
  const I_DESC = {
    0: "ABI ≥ 0.80 or Ankle Pressure ≥ 100 mmHg or TP/TcPO2 ≥ 60 mmHg",
    1: "ABI 0.60–0.79 or Ankle Pressure 70–99 mmHg or TP/TcPO2 40–59 mmHg",
    2: "ABI 0.40–0.59 or Ankle Pressure 50–69 mmHg or TP/TcPO2 30–39 mmHg",
    3: "ABI ≤ 0.39 or Ankle Pressure < 50 mmHg or TP/TcPO2 < 30 mmHg",
  };
  const FI_DESC = {
    0: "No infection",
    1: "Mild infection (local; erythema 0.5–2 cm; no systemic signs)",
    2: "Moderate infection (erythema > 2 cm, lymphangitis, deep tissue, or gangrene; no SIRS)",
    3: "Severe infection (local infection + ≥ 2 SIRS criteria)",
  };
  const AMP = { 1: "Very low 1-year major amputation risk", 2: "Low 1-year major amputation risk", 3: "Moderate 1-year major amputation risk", 4: "High 1-year major amputation risk" };
  const REVASC = { 1: "Benefit from revascularization unlikely", 2: "Low potential benefit from revascularization", 3: "Moderate potential benefit from revascularization", 4: "High potential benefit from revascularization" };
  // Tables indexed [fI][W][I] (Mills JL et al. 2014, Tables VI and VII — copied from the Python reference)
  const AMP_TABLE = [
    [[1, 1, 2, 3], [1, 1, 2, 3], [1, 2, 3, 4], [2, 2, 3, 4]],
    [[1, 1, 2, 3], [1, 2, 2, 3], [1, 2, 3, 4], [2, 2, 3, 4]],
    [[2, 2, 3, 4], [2, 2, 3, 4], [2, 3, 3, 4], [3, 3, 4, 4]],
    [[3, 3, 4, 4], [3, 3, 4, 4], [3, 3, 4, 4], [3, 4, 4, 4]],
  ];
  const REVASC_TABLE = [
    [[1, 2, 3, 4], [1, 2, 3, 4], [2, 3, 3, 4], [2, 3, 4, 4]],
    [[1, 2, 3, 4], [1, 2, 3, 4], [2, 3, 3, 4], [2, 3, 4, 4]],
    [[2, 2, 3, 4], [2, 2, 3, 4], [2, 3, 4, 4], [3, 3, 4, 4]],
    [[2, 3, 4, 4], [2, 3, 4, 4], [3, 3, 4, 4], [3, 4, 4, 4]],
  ];

  function scoreWifiWound({ hasRestPainOnly = false, ulcerDepth }) {
    if (hasRestPainOnly && ulcerDepth === "none") return 0;
    return { none: 0, shallow: 1, deep: 2, extensive: 3 }[ulcerDepth] ?? 0;
  }

  const band = (v, a, b, c) => (v >= a ? 0 : v >= b ? 1 : v >= c ? 2 : 3);
  function scoreWifiIschemia({ abi = null, anklePressureMmhg = null, toePressureMmhg = null, tcpo2Mmhg = null } = {}) {
    const s = [];
    if (abi != null) s.push(band(abi, 0.8, 0.6, 0.4));
    if (anklePressureMmhg != null) s.push(band(anklePressureMmhg, 100, 70, 50));
    if (toePressureMmhg != null) s.push(band(toePressureMmhg, 60, 40, 30));
    if (tcpo2Mmhg != null) s.push(band(tcpo2Mmhg, 60, 40, 30));
    if (!s.length) throw new Error("At least one ischemia measure (ABI, ankle pressure, TP, or TcPO2) is required.");
    return Math.max(...s); // most severe
  }

  function scoreWifiInfection({ noInfection = false, erythemaCm = null, hasLymphangitis = false, hasDeepTissueAbscess = false,
    hasFasciaSpread = false, hasGangrene = false, sirsCriteriaCount = 0 } = {}) {
    if (noInfection) return 0;
    if (sirsCriteriaCount >= 2) return 3;
    if (hasLymphangitis || hasDeepTissueAbscess || hasFasciaSpread || hasGangrene) return 2;
    if (erythemaCm != null) {
      if (erythemaCm > 2) return 2;
      if (erythemaCm > 0.5) return 1;
    }
    return 1;
  }

  function classifyWifi({ w, i, fi }) {
    const stage = AMP_TABLE[fi][w][i], benefit = REVASC_TABLE[fi][w][i], notes = [];
    if (w === 0 && i === 0 && fi === 0) notes.push("WIfI scoring is designed for limb-threatening ischemia (CLTI). Stage 1 here reflects absence of threat, not a PAD severity grade.");
    if (i === 0 && w > 0) notes.push("Adequate perfusion (I=0) with wound present. Wound healing may be possible without revascularization.");
    return { scores: { w, i, fi }, clinical_stage: stage, revasc_benefit: benefit, amp_risk_description: AMP[stage], revasc_benefit_description: REVASC[benefit], notes };
  }

  return { fx, classifyFontaine, classifyRutherford, scoreWifiWound, scoreWifiIschemia, scoreWifiInfection, classifyWifi, W_DESC, I_DESC, FI_DESC };
})();
