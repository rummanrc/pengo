"""Bundle data/*.json into data/bundle.js for file:// fallback.

Classic <script> tags are not subject to fetch CORS rules, so the app
loads this bundle only when fetch() fails (e.g. opened via file://).
Run after scripts/build_data.py.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"

payload = {"levels": {}}
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

js = "window.KK_DATA = " + json.dumps(payload, ensure_ascii=False) + ";"
with open(OUT / "bundle.js", "w", encoding="utf-8", newline="") as f:
    f.write(js)
print("wrote data/bundle.js (%d kanji)" % sum(len(v) for v in payload["levels"].values()))
