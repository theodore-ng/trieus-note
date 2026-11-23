r"""Kiểm tra pad/classification.js khớp 100% với bản Python chuẩn (classification.py).

Cách dùng (Git Bash, từ gốc dự án):
  .venv/Scripts/python webapp/scripts/pad/parity.py <thư mục tạm>
  (cd <thư mục tạm> && python -m http.server 8772 &)
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --virtual-time-budget=20000 \
    --dump-dom http://localhost:8772/parity.html | grep -o 'data-result="[^"]*'
(Obscura không chạy được vì trang dùng XHR đồng bộ.)
Kết quả "OK <số ca>" là khớp; nếu không, in các ca lệch đầu tiên.
Sinh lưới đầu vào quanh mọi ngưỡng (kể cả số .5 để thử cách làm tròn), chạy Python, ghi cases.json; parity.html chạy JS rồi so từng trường.
"""
import itertools, json, os, shutil, sys
from dataclasses import asdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import classification as C  # noqa: E402

out = os.path.abspath(sys.argv[1])
os.makedirs(out, exist_ok=True)
cases = []

for abi, cl, dist, rest, tis in itertools.product(
        [None, 0.125, 0.3, 0.5, 0.89, 0.9, 1.0, 1.3, 1.31, 1.5], [False, True],
        [None, 0, 150, 150.5, 200, 200.5, 201, 1000], [False, True], [False, True]):
    r = C.classify_fontaine(abi, cl, dist, rest, tis)
    cases.append(["fontaine", dict(abi=abi, hasClaudication=cl, walkingDistanceM=dist, hasRestPain=rest, hasTissueLoss=tis),
                  dict(stage=r.stage.value, description=r.description, criteria_met=r.criteria_met, warnings=r.warnings)])

for tis, above, rest, rap, tp, cl, comp, post, tn in itertools.product(
        [False, True], [None, True, False], [False, True], [None, 30, 41, 61, 100.5, 124.5], [None, 20, 41, 40.5],
        [False, True], [None, True, False], [None, 40, 49.5, 50, 51, 100], [None, False]):
    r = C.classify_rutherford(tis, above, rest, rap, tp, cl, comp, post, rap, treadmill_normal=tn)
    cases.append(["rutherford", dict(hasTissueLoss=tis, tissueLossAboveTm=above, hasRestPain=rest, restingApMmhg=rap,
                  toePressureMmhg=tp, hasClaudication=cl, completesTreadmill=comp, postExerciseApMmhg=post,
                  restingApForClaudication=rap, treadmillNormal=tn), asdict(r)])

for a, ap, tp, tc in itertools.product([None, 0.3, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8, 1.0],
                                       [None, 49, 50, 69, 70, 99, 100], [None, 29, 30, 39, 40, 59, 60], [None, 29.5, 30, 45, 60]):
    try:
        exp = C.score_wifi_ischemia(a, ap, tp, tc)
    except ValueError as e:
        exp = "ERR:" + str(e)
    cases.append(["ischemia", dict(abi=a, anklePressureMmhg=ap, toePressureMmhg=tp, tcpo2Mmhg=tc), exp])

for no, ery, ly, de, fa, ga, sirs in itertools.product([False, True], [None, 0, 0.5, 0.6, 2, 2.1], *[[False, True]] * 4, [0, 1, 2, 3]):
    cases.append(["infection", dict(noInfection=no, erythemaCm=ery, hasLymphangitis=ly, hasDeepTissueAbscess=de,
                  hasFasciaSpread=fa, hasGangrene=ga, sirsCriteriaCount=sirs),
                  C.score_wifi_infection(no, ery, ly, de, fa, ga, sirs)])

for ro, depth in itertools.product([False, True], ["none", "shallow", "deep", "extensive", "other"]):
    cases.append(["wound", dict(hasRestPainOnly=ro, ulcerDepth=depth), C.score_wifi_wound(ro, depth)])

for w, i, fi in itertools.product(range(4), range(4), range(4)):
    r = C.classify_wifi(C.WiFiScores(w=w, i=i, fi=fi))
    cases.append(["wifi", dict(w=w, i=i, fi=fi), dict(scores=asdict(r.scores), clinical_stage=r.clinical_stage,
                  amp_risk_description=r.amp_risk_description, revasc_benefit_description=r.revasc_benefit_description, notes=r.notes)])
    # mô tả W/I/fI dùng trong giao diện
    cases.append(["desc", dict(w=w, i=i, fi=fi), [C._W_DESCRIPTIONS[w], C._I_DESCRIPTIONS[i], C._FI_DESCRIPTIONS[fi]]])

json.dump(cases, open(os.path.join(out, "cases.json"), "w", encoding="utf-8"), ensure_ascii=False)
shutil.copy(os.path.join(HERE, "..", "..", "pad", "classification.js"), out)
open(os.path.join(out, "parity.html"), "w", encoding="utf-8").write("""<!doctype html><meta charset="utf-8"><body>
<script src="classification.js"></script>
<script>
const x = new XMLHttpRequest(); x.open("GET", "cases.json", false); x.send();
const cases = JSON.parse(x.responseText), bad = [];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
for (const [kind, inp, exp] of cases) {
  let got;
  try {
    if (kind === "fontaine") got = pick(PAD.classifyFontaine(inp), ["stage", "description", "criteria_met", "warnings"]);
    else if (kind === "rutherford") got = pick(PAD.classifyRutherford(inp), ["grade", "category", "description", "criteria_met", "warnings"]);
    else if (kind === "ischemia") got = PAD.scoreWifiIschemia(inp);
    else if (kind === "infection") got = PAD.scoreWifiInfection(inp);
    else if (kind === "wound") got = PAD.scoreWifiWound(inp);
    else if (kind === "wifi") got = pick(PAD.classifyWifi(inp), ["scores", "clinical_stage", "amp_risk_description", "revasc_benefit_description", "notes"]);
    else if (kind === "desc") got = [PAD.W_DESC[inp.w], PAD.I_DESC[inp.i], PAD.FI_DESC[inp.fi]];
  } catch (e) { got = "ERR:" + e.message; }
  const norm = (v) => JSON.stringify(v, (k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map((q) => [q, val[q]])) : val));
  if (norm(got) !== norm(exp)) bad.push({ kind, inp, exp, got });
}
document.body.dataset.result = bad.length ? "FAIL " + bad.length + "/" + cases.length + " " + JSON.stringify(bad.slice(0, 3)) : "OK " + cases.length;
</script>""")
print("cases:", len(cases), "->", out)
