"""Bundle data/*.json into data/bundle.js for file:// fallback.

Classic <script> tags are not subject to fetch CORS rules, so the app
loads this bundle only when fetch() fails (e.g. opened via file://).
Run after scripts/build_data.py and scripts/build_vocab.py.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"

payload = {"levels": {}, "vocab": {}}
for lv in ["N5", "N4", "N3", "N2", "N1"]:
    with open(OUT / ("%s.json" % lv.lower()), encoding="utf-8") as f:
        payload["levels"][lv] = json.load(f)
with open(OUT / "meta.json", encoding="utf-8") as f:
    payload["meta"] = json.load(f)
try:
    with open(OUT / "radicals.json", encoding="utf-8") as f:
        payload["radicals"] = json.load(f)
except OSError:
    payload["radicals"] = []
try:
    for lv in ["N5", "N4", "N3", "N2", "N1"]:
        with open(OUT / ("vocab_%s.json" % lv.lower()), encoding="utf-8") as f:
            payload["vocab"][lv] = json.load(f)
    with open(OUT / "vocab_meta.json", encoding="utf-8") as f:
        payload["vocab_meta"] = json.load(f)
except OSError:
    payload["vocab"] = {}
    payload["vocab_meta"] = None

js = "window.KK_DATA = " + json.dumps(payload, ensure_ascii=False) + ";"
with open(OUT / "bundle.js", "w", encoding="utf-8", newline="") as f:
    f.write(js)
nk = sum(len(v) for v in payload["levels"].values())
nv = sum(len(v) for v in payload["vocab"].values()) if payload.get("vocab") else 0
print("wrote data/bundle.js (%d kanji, %d vocab)" % (nk, nv))