"""Bundle unchanged KanjiVG SVGs into lazy classic-script fallback chunks.

Classic scripts can load local assets where browsers block fetch/XHR.
Each chunk contains at most 256 code points and retains every SVG notice.
Run after updating resources/stroke-order/kanjivg/*.svg.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "resources/stroke-order/kanjivg"
OUTPUT = ROOT / "data/strokes"


def main():
    chunks = {}
    for path in sorted(SOURCE.glob("*.svg")):
        chunks.setdefault(path.stem[:-2], {})[path.stem] = path.read_text(encoding="utf-8")
    assert chunks, "missing KanjiVG SVGs"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for path in OUTPUT.glob("*.js"):
        if path.stem not in chunks:
            path.unlink()
    for name, diagrams in chunks.items():
        payload = json.dumps(diagrams, ensure_ascii=False, separators=(",", ":"))
        script = ("/* KanjiVG © Ulrich Apel · CC BY-SA 3.0. "
                  "https://kanjivg.tagaini.net/ "
                  "https://creativecommons.org/licenses/by-sa/3.0/ */\n"
                  "window.KK_STROKES = Object.assign(window.KK_STROKES || {}, " + payload + ");\n")
        (OUTPUT / (name + ".js")).write_text(script, encoding="utf-8")
    print("wrote %d stroke fallback chunks (%d unchanged SVGs)" %
          (len(chunks), sum(len(chunk) for chunk in chunks.values())))


if __name__ == "__main__":
    main()
