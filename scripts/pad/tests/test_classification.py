import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from classification import (
    FontaineStage,
    classify_fontaine,
    classify_rutherford,
    WiFiScores,
    score_wifi_ischemia,
    score_wifi_infection,
    score_wifi_wound,
    classify_wifi,
)


# ---------------------------------------------------------------------------
# Fontaine
# ---------------------------------------------------------------------------

class TestFontaine:
    def test_tissue_loss_is_stage_iv(self):
        r = classify_fontaine(abi=0.4, has_claudication=True, walking_distance_m=100,
                               has_rest_pain=True, has_tissue_loss=True)
        assert r.stage == FontaineStage.IV

    def test_tissue_loss_overrides_rest_pain(self):
        r = classify_fontaine(abi=0.3, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=True, has_tissue_loss=True)
        assert r.stage == FontaineStage.IV

    def test_rest_pain_stage_iii(self):
        r = classify_fontaine(abi=0.4, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=True, has_tissue_loss=False)
        assert r.stage == FontaineStage.III

    def test_claudication_200m_is_iib(self):
        # Boundary: exactly 200 m -> Stage IIb
        r = classify_fontaine(abi=0.6, has_claudication=True, walking_distance_m=200,
                               has_rest_pain=False, has_tissue_loss=False)
        assert r.stage == FontaineStage.IIb

    def test_claudication_201m_is_iia(self):
        r = classify_fontaine(abi=0.6, has_claudication=True, walking_distance_m=201,
                               has_rest_pain=False, has_tissue_loss=False)
        assert r.stage == FontaineStage.IIa

    def test_claudication_100m_is_iib(self):
        r = classify_fontaine(abi=0.6, has_claudication=True, walking_distance_m=100,
                               has_rest_pain=False, has_tissue_loss=False)
        assert r.stage == FontaineStage.IIb

    def test_claudication_no_distance_defaults_iib_with_warning(self):
        r = classify_fontaine(abi=0.6, has_claudication=True, walking_distance_m=None,
                               has_rest_pain=False, has_tissue_loss=False)
        assert r.stage == FontaineStage.IIb
        assert any("distance not provided" in w for w in r.warnings)

    def test_asymptomatic_stage_i(self):
        r = classify_fontaine(abi=0.7, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=False, has_tissue_loss=False)
        assert r.stage == FontaineStage.I

    def test_abi_over_1_3_warns_non_compressible(self):
        r = classify_fontaine(abi=1.4, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=False, has_tissue_loss=False)
        assert any("non-compressible" in w for w in r.warnings)

    def test_normal_abi_warns_in_stage_i(self):
        r = classify_fontaine(abi=0.95, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=False, has_tissue_loss=False)
        assert any("normal range" in w for w in r.warnings)

    def test_no_abi_warns_in_stage_i(self):
        r = classify_fontaine(abi=None, has_claudication=False, walking_distance_m=None,
                               has_rest_pain=False, has_tissue_loss=False)
        assert any("ABI not provided" in w for w in r.warnings)


# ---------------------------------------------------------------------------
# Rutherford
# ---------------------------------------------------------------------------

class TestRutherford:
    def test_major_tissue_loss_category_6(self):
        r = classify_rutherford(
            has_tissue_loss=True, tissue_loss_above_tm=True,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.grade == 3 and r.category == 6

    def test_minor_tissue_loss_category_5(self):
        r = classify_rutherford(
            has_tissue_loss=True, tissue_loss_above_tm=False,
            has_rest_pain=False, resting_ap_mmhg=50, toe_pressure_mmhg=30,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.grade == 3 and r.category == 5

    def test_tissue_loss_unknown_extent_defaults_cat5_with_warning(self):
        r = classify_rutherford(
            has_tissue_loss=True, tissue_loss_above_tm=None,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.category == 5
        assert any("extent" in w.lower() for w in r.warnings)

    def test_rest_pain_category_4(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=True, resting_ap_mmhg=35, toe_pressure_mmhg=25,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.grade == 2 and r.category == 4

    def test_rest_pain_high_ap_warns(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=True, resting_ap_mmhg=80, toe_pressure_mmhg=None,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.category == 4
        assert any("40 mmHg" in w for w in r.warnings)

    def test_mild_claudication_category_1(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=True, completes_treadmill=True,
            post_exercise_ap_mmhg=60, resting_ap_for_claudication=100,
        )
        assert r.grade == 1 and r.category == 1

    def test_severe_claudication_category_3(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=True, completes_treadmill=False,
            post_exercise_ap_mmhg=40, resting_ap_for_claudication=None,
        )
        assert r.grade == 1 and r.category == 3

    def test_claudication_no_treadmill_warns_and_defaults_cat2(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=True, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
        )
        assert r.category == 2
        assert any("treadmill" in w.lower() for w in r.warnings)

    def test_asymptomatic_category_0(self):
        r = classify_rutherford(
            has_tissue_loss=False, tissue_loss_above_tm=None,
            has_rest_pain=False, resting_ap_mmhg=None, toe_pressure_mmhg=None,
            has_claudication=False, completes_treadmill=None,
            post_exercise_ap_mmhg=None, resting_ap_for_claudication=None,
            asymptomatic=True,
        )
        assert r.grade == 0 and r.category == 0


# ---------------------------------------------------------------------------
# WIfI — ischemia scoring
# ---------------------------------------------------------------------------

class TestWiFiIschemia:
    def test_abi_080_is_score_0(self):
        assert score_wifi_ischemia(abi=0.80) == 0

    def test_abi_079_is_score_1(self):
        assert score_wifi_ischemia(abi=0.79) == 1

    def test_abi_060_is_score_1(self):
        assert score_wifi_ischemia(abi=0.60) == 1

    def test_abi_059_is_score_2(self):
        assert score_wifi_ischemia(abi=0.59) == 2

    def test_abi_040_is_score_2(self):
        assert score_wifi_ischemia(abi=0.40) == 2

    def test_abi_039_is_score_3(self):
        assert score_wifi_ischemia(abi=0.39) == 3

    def test_ankle_pressure_100_is_score_0(self):
        assert score_wifi_ischemia(ankle_pressure_mmhg=100) == 0

    def test_ankle_pressure_99_is_score_1(self):
        assert score_wifi_ischemia(ankle_pressure_mmhg=99) == 1

    def test_ankle_pressure_49_is_score_3(self):
        assert score_wifi_ischemia(ankle_pressure_mmhg=49) == 3

    def test_uses_worst_measure(self):
        # ABI=0.85 (score 0) but ankle pressure=45 (score 3) -> should return 3
        assert score_wifi_ischemia(abi=0.85, ankle_pressure_mmhg=45) == 3

    def test_toe_pressure_60_is_score_0(self):
        assert score_wifi_ischemia(toe_pressure_mmhg=60) == 0

    def test_toe_pressure_39_is_score_2(self):
        # 30 <= tp < 40 -> score 2
        assert score_wifi_ischemia(toe_pressure_mmhg=39) == 2

    def test_toe_pressure_29_is_score_3(self):
        assert score_wifi_ischemia(toe_pressure_mmhg=29) == 3

    def test_no_measures_raises(self):
        with pytest.raises(ValueError):
            score_wifi_ischemia()


# ---------------------------------------------------------------------------
# WIfI — infection scoring
# ---------------------------------------------------------------------------

class TestWiFiInfection:
    def test_no_infection(self):
        assert score_wifi_infection(no_infection=True) == 0

    def test_mild_erythema(self):
        assert score_wifi_infection(erythema_cm=1.0) == 1

    def test_erythema_over_2cm_is_fi2(self):
        assert score_wifi_infection(erythema_cm=2.5) == 2

    def test_lymphangitis_is_fi2(self):
        assert score_wifi_infection(has_lymphangitis=True) == 2

    def test_sirs_2_criteria_is_fi3(self):
        assert score_wifi_infection(sirs_criteria_count=2) == 3

    def test_sirs_overrides_local(self):
        # Even with only mild erythema, SIRS makes it fI=3
        assert score_wifi_infection(erythema_cm=1.0, sirs_criteria_count=2) == 3


# ---------------------------------------------------------------------------
# WIfI — final classification
# ---------------------------------------------------------------------------

class TestWiFiClassify:
    def test_all_zero_is_stage_1(self):
        r = classify_wifi(WiFiScores(w=0, i=0, fi=0))
        assert r.clinical_stage == 1
        assert any("CLTI" in n for n in r.notes)

    def test_all_max_is_stage_4(self):
        r = classify_wifi(WiFiScores(w=3, i=3, fi=3))
        assert r.clinical_stage == 4

    def test_moderate_wound_severe_ischemia_no_infection(self):
        # (fi=0, w=2, i=3) -> stage 4
        r = classify_wifi(WiFiScores(w=2, i=3, fi=0))
        assert r.clinical_stage == 4

    def test_severe_infection_raises_stage(self):
        # (fi=3, w=0, i=0) -> stage 3
        r = classify_wifi(WiFiScores(w=0, i=0, fi=3))
        assert r.clinical_stage == 3

    def test_revasc_benefit_low_for_low_ischemia(self):
        # (fi=0, w=0, i=0) -> benefit 1 (unlikely)
        r = classify_wifi(WiFiScores(w=0, i=0, fi=0))
        assert "unlikely" in r.revasc_benefit_description.lower()

    def test_revasc_benefit_high_for_severe_ischemia(self):
        # (fi=0, w=0, i=3) -> benefit 4 (high)
        r = classify_wifi(WiFiScores(w=0, i=3, fi=0))
        assert "high" in r.revasc_benefit_description.lower()

    def test_adequate_perfusion_with_wound_note(self):
        r = classify_wifi(WiFiScores(w=2, i=0, fi=0))
        assert any("adequate" in n.lower() for n in r.notes)
