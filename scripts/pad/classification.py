"""
PAD Classification Logic
Sources:
  Fontaine: Fontaine R, Kim M, Kieny R (1954). Rev Chir Orthop.
  Rutherford: Rutherford RB et al. (1986). J Vasc Surg 4(1):80-94.
  WIfI: Mills JL et al. (2014). J Vasc Surg 59(1):220-234.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, Optional


# ---------------------------------------------------------------------------
# Fontaine
# ---------------------------------------------------------------------------

class FontaineStage(Enum):
    I   = "I"
    IIa = "IIa"
    IIb = "IIb"
    III = "III"
    IV  = "IV"


_FONTAINE_DESCRIPTIONS = {
    FontaineStage.I:   "Asymptomatic peripheral arterial disease",
    FontaineStage.IIa: "Mild claudication (pain-free walking > 200 m)",
    FontaineStage.IIb: "Moderate to severe claudication (pain-free walking ≤ 200 m)",
    FontaineStage.III: "Ischemic rest pain",
    FontaineStage.IV:  "Ulceration or gangrene (tissue loss)",
}


@dataclass
class FontaineResult:
    stage: FontaineStage
    description: str
    criteria_met: str
    warnings: list[str] = field(default_factory=list)


def classify_fontaine(
    abi: Optional[float],
    has_claudication: bool,
    walking_distance_m: Optional[float],
    has_rest_pain: bool,
    has_tissue_loss: bool,
) -> FontaineResult:
    warnings: list[str] = []

    if abi is not None and abi > 1.3:
        warnings.append(
            "ABI > 1.3 suggests non-compressible vessels (medial calcification). "
            "ABI is unreliable; consider toe-brachial index."
        )

    # Priority hierarchy: IV > III > IIb > IIa > I
    if has_tissue_loss:
        return FontaineResult(
            stage=FontaineStage.IV,
            description=_FONTAINE_DESCRIPTIONS[FontaineStage.IV],
            criteria_met="Ulceration or gangrene present",
            warnings=warnings,
        )

    if has_rest_pain:
        return FontaineResult(
            stage=FontaineStage.III,
            description=_FONTAINE_DESCRIPTIONS[FontaineStage.III],
            criteria_met="Ischemic rest pain present",
            warnings=warnings,
        )

    if has_claudication:
        dist = walking_distance_m
        if dist is None:
            # Cannot distinguish IIa vs IIb without distance
            warnings.append(
                "Walking distance not provided; cannot distinguish Stage IIa (> 200 m) "
                "from Stage IIb (≤ 200 m). Defaulting to IIb (more conservative)."
            )
            return FontaineResult(
                stage=FontaineStage.IIb,
                description=_FONTAINE_DESCRIPTIONS[FontaineStage.IIb],
                criteria_met="Claudication present; walking distance unknown",
                warnings=warnings,
            )
        if dist <= 200:
            return FontaineResult(
                stage=FontaineStage.IIb,
                description=_FONTAINE_DESCRIPTIONS[FontaineStage.IIb],
                criteria_met=f"Claudication with pain-free walking distance ≤ 200 m ({dist:.0f} m reported)",
                warnings=warnings,
            )
        else:
            return FontaineResult(
                stage=FontaineStage.IIa,
                description=_FONTAINE_DESCRIPTIONS[FontaineStage.IIa],
                criteria_met=f"Claudication with pain-free walking distance > 200 m ({dist:.0f} m reported)",
                warnings=warnings,
            )

    # Stage I: asymptomatic
    if abi is None:
        warnings.append(
            "ABI not provided. Stage I requires hemodynamic confirmation (ABI < 0.9)."
        )
    elif abi >= 0.9 and abi <= 1.3:
        warnings.append(
            f"ABI {abi:.2f} is within normal range (≥ 0.9). "
            "PAD diagnosis should be reconsidered or confirmed with further testing."
        )
    return FontaineResult(
        stage=FontaineStage.I,
        description=_FONTAINE_DESCRIPTIONS[FontaineStage.I],
        criteria_met="Asymptomatic; no claudication, rest pain, or tissue loss",
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Rutherford
# ---------------------------------------------------------------------------

@dataclass
class RutherfordResult:
    grade: int          # 0–3
    category: int       # 0–6
    description: str
    criteria_met: str
    warnings: list[str] = field(default_factory=list)


_RUTHERFORD_DESCRIPTIONS = {
    (0, 0): "Asymptomatic — no hemodynamic compromise",
    (1, 1): "Mild claudication",
    (1, 2): "Moderate claudication",
    (1, 3): "Severe claudication",
    (2, 4): "Ischemic rest pain",
    (3, 5): "Minor tissue loss (non-healing ulcer or focal gangrene with diffuse pedal ischemia)",
    (3, 6): "Major tissue loss (extending above transmetatarsal level; functional foot not salvageable)",
}


def classify_rutherford(
    has_tissue_loss: bool,
    tissue_loss_above_tm: Optional[bool],
    has_rest_pain: bool,
    resting_ap_mmhg: Optional[float],
    toe_pressure_mmhg: Optional[float],
    has_claudication: bool,
    completes_treadmill: Optional[bool],
    post_exercise_ap_mmhg: Optional[float],
    resting_ap_for_claudication: Optional[float],
    asymptomatic: bool = False,
    treadmill_normal: Optional[bool] = None,
) -> RutherfordResult:
    warnings: list[str] = []

    # Category 6: major tissue loss
    if has_tissue_loss:
        if tissue_loss_above_tm is True:
            return RutherfordResult(
                grade=3, category=6,
                description=_RUTHERFORD_DESCRIPTIONS[(3, 6)],
                criteria_met="Tissue loss extending proximal to transmetatarsal level",
                warnings=warnings,
            )
        if tissue_loss_above_tm is False:
            _check_hemodynamics_clti(resting_ap_mmhg, toe_pressure_mmhg, warnings, category=5)
            return RutherfordResult(
                grade=3, category=5,
                description=_RUTHERFORD_DESCRIPTIONS[(3, 5)],
                criteria_met="Tissue loss distal to transmetatarsal level with pedal ischemia",
                warnings=warnings,
            )
        # tissue_loss_above_tm is None — unknown extent
        warnings.append(
            "Tissue loss present but extent relative to transmetatarsal level not specified. "
            "Category 5 assigned; upgrade to Category 6 if loss is proximal to TM level."
        )
        _check_hemodynamics_clti(resting_ap_mmhg, toe_pressure_mmhg, warnings, category=5)
        return RutherfordResult(
            grade=3, category=5,
            description=_RUTHERFORD_DESCRIPTIONS[(3, 5)],
            criteria_met="Tissue loss (extent unspecified; defaulted to Category 5)",
            warnings=warnings,
        )

    # Category 4: rest pain
    if has_rest_pain:
        if resting_ap_mmhg is not None and resting_ap_mmhg > 40:
            warnings.append(
                f"Resting ankle pressure {resting_ap_mmhg:.0f} mmHg > 40 mmHg. "
                "Rutherford Category 4 typically requires AP ≤ 40 mmHg or TP < 30 mmHg."
            )
        elif resting_ap_mmhg is None and toe_pressure_mmhg is None:
            warnings.append(
                "No hemodynamic data provided for rest pain staging. "
                "Category 4 requires resting AP ≤ 40 mmHg or TP < 30 mmHg for confirmation."
            )
        return RutherfordResult(
            grade=2, category=4,
            description=_RUTHERFORD_DESCRIPTIONS[(2, 4)],
            criteria_met="Ischemic rest pain present",
            warnings=warnings,
        )

    # Categories 1–3: claudication
    if has_claudication:
        if completes_treadmill is None and post_exercise_ap_mmhg is None:
            warnings.append(
                "Treadmill exercise testing not performed or data unavailable. "
                "Formal Rutherford grading of claudication requires standard treadmill protocol "
                "(5 min, 12% grade, 2 mph). Category estimated as 2 (moderate) pending objective testing."
            )
            return RutherfordResult(
                grade=1, category=2,
                description=_RUTHERFORD_DESCRIPTIONS[(1, 2)],
                criteria_met="Claudication present; treadmill data unavailable (Category 2 estimated)",
                warnings=warnings,
            )

        post_ap = post_exercise_ap_mmhg
        resting = resting_ap_for_claudication

        if completes_treadmill is True:
            # Cat 1: completes treadmill, post-AP > 50 mmHg AND ≥ 25 mmHg below resting
            if post_ap is not None and post_ap > 50:
                if resting is not None and (resting - post_ap) >= 25:
                    return RutherfordResult(
                        grade=1, category=1,
                        description=_RUTHERFORD_DESCRIPTIONS[(1, 1)],
                        criteria_met=(
                            f"Completes treadmill; post-exercise AP {post_ap:.0f} mmHg > 50 mmHg "
                            f"and ≥ 25 mmHg drop from resting ({resting:.0f} mmHg)"
                        ),
                        warnings=warnings,
                    )
            warnings.append(
                "Treadmill completed but hemodynamic criteria for Category 1 not fully met. "
                "Category 2 assigned."
            )
            return RutherfordResult(
                grade=1, category=2,
                description=_RUTHERFORD_DESCRIPTIONS[(1, 2)],
                criteria_met="Completes treadmill; hemodynamic data partially meets Category 2",
                warnings=warnings,
            )
        else:
            # Does not complete treadmill
            if post_ap is not None and post_ap < 50:
                return RutherfordResult(
                    grade=1, category=3,
                    description=_RUTHERFORD_DESCRIPTIONS[(1, 3)],
                    criteria_met=(
                        f"Does not complete treadmill; post-exercise AP {post_ap:.0f} mmHg < 50 mmHg"
                    ),
                    warnings=warnings,
                )
            warnings.append(
                "Does not complete treadmill but post-exercise AP ≥ 50 mmHg or unknown. "
                "Category 2 assigned; reassess with full hemodynamic data."
            )
            return RutherfordResult(
                grade=1, category=2,
                description=_RUTHERFORD_DESCRIPTIONS[(1, 2)],
                criteria_met="Does not complete treadmill; post-exercise AP ≥ 50 mmHg (moderate claudication)",
                warnings=warnings,
            )

    # Category 0: asymptomatic
    if treadmill_normal is False:
        warnings.append(
            "Asymptomatic selected but treadmill test is abnormal. "
            "Consider Category 1 if hemodynamic compromise is confirmed."
        )
    return RutherfordResult(
        grade=0, category=0,
        description=_RUTHERFORD_DESCRIPTIONS[(0, 0)],
        criteria_met="Asymptomatic; no claudication, rest pain, or tissue loss",
        warnings=warnings,
    )


def _check_hemodynamics_clti(
    ap: Optional[float],
    tp: Optional[float],
    warnings: list[str],
    category: int,
) -> None:
    thresholds = {5: (60, 40), 6: (60, 40)}
    ap_threshold, tp_threshold = thresholds[category]
    if ap is not None and ap > ap_threshold:
        warnings.append(
            f"Resting ankle pressure {ap:.0f} mmHg > {ap_threshold} mmHg threshold for Category {category}."
        )
    if tp is not None and tp > tp_threshold:
        warnings.append(
            f"Toe pressure {tp:.0f} mmHg > {tp_threshold} mmHg threshold for Category {category}."
        )


# ---------------------------------------------------------------------------
# WIfI
# ---------------------------------------------------------------------------

WScore = Literal[0, 1, 2, 3]
IScore = Literal[0, 1, 2, 3]
FiScore = Literal[0, 1, 2, 3]


@dataclass
class WiFiScores:
    w:  WScore
    i:  IScore
    fi: FiScore


@dataclass
class WiFiResult:
    scores: WiFiScores
    clinical_stage: Literal[1, 2, 3, 4]
    amp_risk_description: str
    revasc_benefit_description: str
    notes: list[str] = field(default_factory=list)


_W_DESCRIPTIONS = {
    0: "No wound / ischemic rest pain only",
    1: "Small shallow ulcer(s) on distal leg/foot; no exposed bone (except IPJ of toe)",
    2: "Deeper ulcer with exposed tendon, capsule, or bone; or shallow heel ulcer",
    3: "Extensive/deep ulcer of forefoot ± midfoot; deep heel ulcer ± calcaneal involvement",
}

_I_DESCRIPTIONS = {
    0: "ABI ≥ 0.80 or Ankle Pressure ≥ 100 mmHg or TP/TcPO2 ≥ 60 mmHg",
    1: "ABI 0.60–0.79 or Ankle Pressure 70–99 mmHg or TP/TcPO2 40–59 mmHg",
    2: "ABI 0.40–0.59 or Ankle Pressure 50–69 mmHg or TP/TcPO2 30–39 mmHg",
    3: "ABI ≤ 0.39 or Ankle Pressure < 50 mmHg or TP/TcPO2 < 30 mmHg",
}

_FI_DESCRIPTIONS = {
    0: "No infection",
    1: "Mild infection (local; erythema 0.5–2 cm; no systemic signs)",
    2: "Moderate infection (erythema > 2 cm, lymphangitis, deep tissue, or gangrene; no SIRS)",
    3: "Severe infection (local infection + ≥ 2 SIRS criteria)",
}

_AMP_RISK_DESCRIPTIONS = {
    1: "Very low 1-year major amputation risk",
    2: "Low 1-year major amputation risk",
    3: "Moderate 1-year major amputation risk",
    4: "High 1-year major amputation risk",
}

_REVASC_BENEFIT_DESCRIPTIONS = {
    1: "Benefit from revascularization unlikely",
    2: "Low potential benefit from revascularization",
    3: "Moderate potential benefit from revascularization",
    4: "High potential benefit from revascularization",
}

# WIfI amputation risk staging table: (fi, w, i) -> clinical stage (1–4)
# Source: Mills JL et al. J Vasc Surg 2014;59(1):220-34, Table VI
_WIFI_AMP_RISK_TABLE: dict[tuple[int, int, int], int] = {
    # fI=0
    (0, 0, 0): 1, (0, 0, 1): 1, (0, 0, 2): 2, (0, 0, 3): 3,
    (0, 1, 0): 1, (0, 1, 1): 1, (0, 1, 2): 2, (0, 1, 3): 3,
    (0, 2, 0): 1, (0, 2, 1): 2, (0, 2, 2): 3, (0, 2, 3): 4,
    (0, 3, 0): 2, (0, 3, 1): 2, (0, 3, 2): 3, (0, 3, 3): 4,
    # fI=1
    (1, 0, 0): 1, (1, 0, 1): 1, (1, 0, 2): 2, (1, 0, 3): 3,
    (1, 1, 0): 1, (1, 1, 1): 2, (1, 1, 2): 2, (1, 1, 3): 3,
    (1, 2, 0): 1, (1, 2, 1): 2, (1, 2, 2): 3, (1, 2, 3): 4,
    (1, 3, 0): 2, (1, 3, 1): 2, (1, 3, 2): 3, (1, 3, 3): 4,
    # fI=2
    (2, 0, 0): 2, (2, 0, 1): 2, (2, 0, 2): 3, (2, 0, 3): 4,
    (2, 1, 0): 2, (2, 1, 1): 2, (2, 1, 2): 3, (2, 1, 3): 4,
    (2, 2, 0): 2, (2, 2, 1): 3, (2, 2, 2): 3, (2, 2, 3): 4,
    (2, 3, 0): 3, (2, 3, 1): 3, (2, 3, 2): 4, (2, 3, 3): 4,
    # fI=3
    (3, 0, 0): 3, (3, 0, 1): 3, (3, 0, 2): 4, (3, 0, 3): 4,
    (3, 1, 0): 3, (3, 1, 1): 3, (3, 1, 2): 4, (3, 1, 3): 4,
    (3, 2, 0): 3, (3, 2, 1): 3, (3, 2, 2): 4, (3, 2, 3): 4,
    (3, 3, 0): 3, (3, 3, 1): 4, (3, 3, 2): 4, (3, 3, 3): 4,
}

# WIfI revascularization benefit table: (fi, w, i) -> benefit stage (1–4)
# Source: Mills JL et al. J Vasc Surg 2014;59(1):220-34, Table VII
_WIFI_REVASC_BENEFIT_TABLE: dict[tuple[int, int, int], int] = {
    # fI=0
    (0, 0, 0): 1, (0, 0, 1): 2, (0, 0, 2): 3, (0, 0, 3): 4,
    (0, 1, 0): 1, (0, 1, 1): 2, (0, 1, 2): 3, (0, 1, 3): 4,
    (0, 2, 0): 2, (0, 2, 1): 3, (0, 2, 2): 3, (0, 2, 3): 4,
    (0, 3, 0): 2, (0, 3, 1): 3, (0, 3, 2): 4, (0, 3, 3): 4,
    # fI=1
    (1, 0, 0): 1, (1, 0, 1): 2, (1, 0, 2): 3, (1, 0, 3): 4,
    (1, 1, 0): 1, (1, 1, 1): 2, (1, 1, 2): 3, (1, 1, 3): 4,
    (1, 2, 0): 2, (1, 2, 1): 3, (1, 2, 2): 3, (1, 2, 3): 4,
    (1, 3, 0): 2, (1, 3, 1): 3, (1, 3, 2): 4, (1, 3, 3): 4,
    # fI=2
    (2, 0, 0): 2, (2, 0, 1): 2, (2, 0, 2): 3, (2, 0, 3): 4,
    (2, 1, 0): 2, (2, 1, 1): 2, (2, 1, 2): 3, (2, 1, 3): 4,
    (2, 2, 0): 2, (2, 2, 1): 3, (2, 2, 2): 4, (2, 2, 3): 4,
    (2, 3, 0): 3, (2, 3, 1): 3, (2, 3, 2): 4, (2, 3, 3): 4,
    # fI=3
    (3, 0, 0): 2, (3, 0, 1): 3, (3, 0, 2): 4, (3, 0, 3): 4,
    (3, 1, 0): 2, (3, 1, 1): 3, (3, 1, 2): 4, (3, 1, 3): 4,
    (3, 2, 0): 3, (3, 2, 1): 3, (3, 2, 2): 4, (3, 2, 3): 4,
    (3, 3, 0): 3, (3, 3, 1): 4, (3, 3, 2): 4, (3, 3, 3): 4,
}


def score_wifi_wound(
    has_rest_pain_only: bool,
    ulcer_depth: Literal["none", "shallow", "deep", "extensive"],
    heel_ulcer: bool = False,
    heel_bone_involved: bool = False,
    ipj_bone_exposed: bool = False,
) -> WScore:
    if has_rest_pain_only and ulcer_depth == "none":
        return 0
    if ulcer_depth == "none":
        return 0
    if ulcer_depth == "shallow":
        # IPJ bone exposure in a shallow ulcer still scores W=1
        return 1
    if ulcer_depth == "deep":
        if heel_ulcer:
            # Shallow heel ulcer with or without bone involvement = W=2
            return 2
        return 2
    if ulcer_depth == "extensive":
        return 3
    return 0


def score_wifi_ischemia(
    abi: Optional[float] = None,
    ankle_pressure_mmhg: Optional[float] = None,
    toe_pressure_mmhg: Optional[float] = None,
    tcpo2_mmhg: Optional[float] = None,
) -> IScore:
    scores: list[int] = []

    if abi is not None:
        if abi >= 0.80:
            scores.append(0)
        elif abi >= 0.60:
            scores.append(1)
        elif abi >= 0.40:
            scores.append(2)
        else:
            scores.append(3)

    if ankle_pressure_mmhg is not None:
        ap = ankle_pressure_mmhg
        if ap >= 100:
            scores.append(0)
        elif ap >= 70:
            scores.append(1)
        elif ap >= 50:
            scores.append(2)
        else:
            scores.append(3)

    if toe_pressure_mmhg is not None:
        tp = toe_pressure_mmhg
        if tp >= 60:
            scores.append(0)
        elif tp >= 40:
            scores.append(1)
        elif tp >= 30:
            scores.append(2)
        else:
            scores.append(3)

    if tcpo2_mmhg is not None:
        tc = tcpo2_mmhg
        if tc >= 60:
            scores.append(0)
        elif tc >= 40:
            scores.append(1)
        elif tc >= 30:
            scores.append(2)
        else:
            scores.append(3)

    if not scores:
        raise ValueError("At least one ischemia measure (ABI, ankle pressure, TP, or TcPO2) is required.")

    # Use the most severe (highest) score
    return max(scores)  # type: ignore[return-value]


def score_wifi_infection(
    no_infection: bool = False,
    erythema_cm: Optional[float] = None,
    has_lymphangitis: bool = False,
    has_deep_tissue_abscess: bool = False,
    has_fascia_spread: bool = False,
    has_gangrene: bool = False,
    sirs_criteria_count: int = 0,
) -> FiScore:
    if no_infection:
        return 0

    has_severe_local = (
        has_lymphangitis
        or has_deep_tissue_abscess
        or has_fascia_spread
        or has_gangrene
    )

    if sirs_criteria_count >= 2:
        return 3

    if has_severe_local:
        return 2

    if erythema_cm is not None:
        if erythema_cm > 2:
            return 2
        if erythema_cm > 0.5:
            return 1

    return 1  # some infection signs present but not meeting fI=2 criteria


def classify_wifi(scores: WiFiScores) -> WiFiResult:
    key = (scores.fi, scores.w, scores.i)
    clinical_stage = _WIFI_AMP_RISK_TABLE[key]
    revasc_benefit = _WIFI_REVASC_BENEFIT_TABLE[key]

    notes: list[str] = []
    if scores.w == 0 and scores.i == 0 and scores.fi == 0:
        notes.append(
            "WIfI scoring is designed for limb-threatening ischemia (CLTI). "
            "Stage 1 here reflects absence of threat, not a PAD severity grade."
        )
    if scores.i == 0 and scores.w > 0:
        notes.append(
            "Adequate perfusion (I=0) with wound present. "
            "Wound healing may be possible without revascularization."
        )

    return WiFiResult(
        scores=scores,
        clinical_stage=clinical_stage,
        amp_risk_description=_AMP_RISK_DESCRIPTIONS[clinical_stage],
        revasc_benefit_description=_REVASC_BENEFIT_DESCRIPTIONS[revasc_benefit],
        notes=notes,
    )
