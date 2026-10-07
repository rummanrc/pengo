"""Assemble the offline web bundle for Capacitor / native WebView.

Copies only runtime files into www/ (no build step, no npm needed):
  index.html, app.js, platform.js, styles.css,
  manifest.webmanifest, assets/,
  data/*.json (levels + radicals + meta) and data/bundle.js (file:// fallback),
  resources/stroke-order/ (KanjiVG SVGs), resources/CREDITS.md (linked from footer).

Run:  python scripts/sync_www.py [--out www]
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / (sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "www")

FILES = ["index.html", "app.js", "onboarding.js", "course.js", "practice.js", "practice-ui.js", "platform.js", "styles.css", "manifest.webmanifest"]
DIRS = ["assets", "data"]
EXTRA = [
    ("resources/stroke-order", "resources/stroke-order"),
    ("resources/CREDITS.md", "resources/CREDITS.md"),
]

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        src = ROOT / name
        assert src.is_file(), "missing runtime file: %s" % name
        shutil.copy2(src, OUT / name)
    for name in DIRS:
        src = ROOT / name
        assert src.is_dir(), "missing runtime dir: %s" % name
        shutil.copytree(src, OUT / name, dirs_exist_ok=True)
    for src_rel, dst_rel in EXTRA:
        src = ROOT / src_rel
        dst = OUT / dst_rel
        assert src.exists(), "missing runtime path: %s" % src_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    n = sum(1 for f in OUT.rglob("*") if f.is_file())
    print("www bundle: %d files, %.1f MB -> %s" % (n, total / 1048576.0, OUT))

if __name__ == "__main__":
    main()