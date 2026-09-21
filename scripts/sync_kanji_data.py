"""Refresh the vendored copy of davidluzgouveia/kanji-data.

Upstream: https://github.com/davidluzgouveia/kanji-data (kanji.json:
KANJIDIC + JLPT levels + WaniKani radicals/meanings/readings).
Local copy: resources/kanji/kanji_metadata.json (byte-identical layout).

Usage:
    python scripts/sync_kanji_data.py          # report only (no changes)
    python scripts/sync_kanji_data.py --write  # refresh the vendored copy

After --write, run scripts/build_data.py + scripts/build_bundle.py.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

UPSTREAM = "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json"
LOCAL = Path(__file__).resolve().parent.parent / "resources" / "kanji" / "kanji_metadata.json"


def fetch_upstream():
    with urllib.request.urlopen(UPSTREAM, timeout=60) as r:
        return r.read()


def summarize(data):
    wk = sum(1 for m in data.values() if isinstance(m, dict) and m.get("wk_radicals"))
    return {"kanji": len(data), "with_wk_radicals": wk}


def main():
    raw = fetch_upstream()
    upstream = json.loads(raw.decode("utf-8"))
    local = json.loads(LOCAL.read_text(encoding="utf-8"))
    print("upstream:", UPSTREAM)
    print("upstream sha256:", hashlib.sha256(raw).hexdigest())
    print("upstream:", summarize(upstream))
    print("local:   ", summarize(local))
    same_keys = set(upstream) == set(local)
    print("same key set:", same_keys)
    if not same_keys:
        only_up = sorted(set(upstream) - set(local))[:10]
        only_local = sorted(set(local) - set(upstream))[:10]
        print("only upstream:", only_up)
        print("only local:", only_local)
    if raw.decode("utf-8-sig") == LOCAL.read_text(encoding="utf-8"):
        print("vendored copy is already up to date.")
        return
    print("vendored copy DIFFERS from upstream.")
    if "--write" not in sys.argv:
        print("re-run with --write to refresh it.")
        return
    LOCAL.write_text(raw.decode("utf-8"), encoding="utf-8")
    print("refreshed", LOCAL)


if __name__ == "__main__":
    main()
