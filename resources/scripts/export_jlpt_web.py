#!/usr/bin/env python3
"""Export slim per-level JSON for a JLPT web quiz app (e.g. the jlpt app).

Reads kanji_n{1-5}.csv (compounds with kanjium pitch accent already applied
by add_pitch_accent.py) and kanji_metadata.json (on'yomi/kun'yomi/strokes/
freq) from --src-dir, and writes into --output-dir:

    kanji-n{1-5}.json      one entry per kanji
    compounds-n{1-5}.json  deduped compound words per level

When --src-dir is the default (kanji-data's own kanji/), it also writes the
same compound-word output into kanji-data's own compounds/jlpt-compounds-n{1-5}.json
— the app-agnostic shared compounds domain — so that file regenerates
automatically whenever anyone runs this script, regardless of which app's
--output-dir it was pointed at. Skipped when --src-dir is overridden to
something else (e.g. pointed at a local draft/test CSV set), so a one-off
experiment can't clobber the shared file with non-canonical data.

Prints fill-rate / parse-failure diagnostics so silent data loss doesn't
ship into the app.

Typical invocation from a consuming app's repo root, with kanji-data checked
out as a submodule at vendor/kanji-data:

    python3 vendor/kanji-data/scripts/export_jlpt_web.py \\
        --src-dir vendor/kanji-data/kanji --output-dir data
"""

import argparse
import csv
import json
import re
from pathlib import Path

LEVELS = [5, 4, 3, 2, 1]
COMPOUND_RE = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*=\s*(.*)$")

# Defaults assume the script still lives at kanji-data/scripts/export_jlpt_web.py
DEFAULT_SRC_DIR = Path(__file__).parent.parent / "kanji"
DEFAULT_OUT_DIR = Path("data")
SHARED_COMPOUNDS_DIR = Path(__file__).parent.parent / "compounds"


def load_metadata(src_dir):
    with open(src_dir / "kanji_metadata.json", encoding="utf-8") as f:
        return json.load(f)


def parse_compounds(compounds_str, stats):
    """Return list of {word, reading, accent, meaning} from a CSV compounds cell."""
    if not compounds_str or not compounds_str.strip():
        return []

    out = []
    for part in compounds_str.split(";"):
        part = part.strip()
        if not part:
            continue
        m = COMPOUND_RE.match(part)
        if not m:
            stats["parse_failures"] += 1
            stats["parse_failure_samples"].append(part)
            continue
        word = m.group(1).strip()
        reading_field = m.group(2).strip()
        meaning = m.group(3).strip()

        if "·" in reading_field:  # middle dot inserted by add_pitch_accent.py
            reading, accent = reading_field.split("·", 1)
        else:
            reading, accent = reading_field, None

        out.append({"word": word, "reading": reading, "accent": accent, "meaning": meaning})
        stats["compounds_total"] += 1
        if accent is None:
            stats["compounds_no_accent"] += 1
    return out


def dedup_key(word, reading):
    return f"{word} {reading}"


def export_level(level, meta, stats, src_dir, out_dir, write_shared_compounds):
    csv_path = src_dir / f"kanji_n{level}.csv"
    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    kanji_entries = []
    compounds_by_key = {}
    no_readings = []

    for row in rows:
        ch = row["kanji"]
        m = meta.get(ch, {})
        onyomi = m.get("readings_on") or []
        kunyomi = m.get("readings_kun") or []
        readings = list(dict.fromkeys(onyomi + kunyomi))  # dedup, keep order

        if not readings:
            no_readings.append(ch)
            continue

        # "-" marks a bound (prefix/suffix-only) reading, e.g. "ひと-" in 一
        # or "-び" in 火 — not a standalone pronunciation, so it's excluded
        # from the quiz answer pool but kept in onyomi/kunyomi for display.
        quiz_readings = [r for r in readings if "-" not in r]
        if not quiz_readings:
            stats["affix_only_fallback"].append(ch)
            quiz_readings = readings

        compounds = parse_compounds(row.get("compounds", ""), stats)

        kanji_entries.append({
            "kanji": ch,
            "onyomi": onyomi,
            "kunyomi": kunyomi,
            "readings": quiz_readings,
            "meaning": row.get("meaning", ""),
            "strokes": m.get("strokes"),
            "freq": m.get("freq"),
            "sentence": row.get("sentence", ""),
            "compounds": compounds,
        })

        for c in compounds:
            key = dedup_key(c["word"], c["reading"])
            existing = compounds_by_key.get(key)
            if existing:
                existing["sourceKanji"].add(ch)
            else:
                # Deliberately not "kanji": the app's itemText() picks
                # entry.kanji over entry.word when both are present (that's
                # how it tells a kanji-mode entry from a compound-mode one),
                # so naming this field "kanji" would make every compound
                # question render/identify itself by its source-kanji array
                # instead of the actual word — see CLAUDE.md.
                compounds_by_key[key] = {
                    "word": c["word"],
                    "reading": c["reading"],
                    "readings": [c["reading"]],
                    "accent": c["accent"],
                    "meaning": c["meaning"],
                    "sourceKanji": {ch},
                }

    compound_entries = []
    for entry in compounds_by_key.values():
        entry["sourceKanji"] = sorted(entry["sourceKanji"])
        compound_entries.append(entry)

    if no_readings:
        stats["no_readings"][level] = no_readings

    out_dir.mkdir(parents=True, exist_ok=True)
    kanji_path = out_dir / f"kanji-n{level}.json"
    compounds_path = out_dir / f"compounds-n{level}.json"
    with open(kanji_path, "w", encoding="utf-8") as f:
        json.dump(kanji_entries, f, ensure_ascii=False, indent=1)
    with open(compounds_path, "w", encoding="utf-8") as f:
        json.dump(compound_entries, f, ensure_ascii=False, indent=1)

    shared_note = ""
    if write_shared_compounds:
        SHARED_COMPOUNDS_DIR.mkdir(parents=True, exist_ok=True)
        shared_compounds_path = SHARED_COMPOUNDS_DIR / f"jlpt-compounds-n{level}.json"
        with open(shared_compounds_path, "w", encoding="utf-8") as f:
            json.dump(compound_entries, f, ensure_ascii=False, indent=1)
        shared_note = f", {shared_compounds_path.relative_to(SHARED_COMPOUNDS_DIR.parent)}"

    print(f"N{level}: {len(kanji_entries)} kanji (skipped {len(no_readings)} w/o readings), "
          f"{len(compound_entries)} unique compounds -> {kanji_path.name}, {compounds_path.name}"
          f"{shared_note}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src-dir", type=Path, default=DEFAULT_SRC_DIR,
                         help=f"Directory with kanji_n{{1-5}}.csv + kanji_metadata.json (default: {DEFAULT_SRC_DIR})")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT_DIR,
                         help=f"Directory to write kanji-n{{1-5}}.json + compounds-n{{1-5}}.json into (default: {DEFAULT_OUT_DIR})")
    args = parser.parse_args()

    write_shared_compounds = args.src_dir.resolve() == DEFAULT_SRC_DIR.resolve()
    if not write_shared_compounds:
        print(f"--src-dir differs from the default ({DEFAULT_SRC_DIR}); "
              f"skipping the shared {SHARED_COMPOUNDS_DIR.name}/ write.\n")

    meta = load_metadata(args.src_dir)
    stats = {
        "parse_failures": 0,
        "parse_failure_samples": [],
        "compounds_total": 0,
        "compounds_no_accent": 0,
        "no_readings": {},
        "affix_only_fallback": [],
    }

    for level in LEVELS:
        export_level(level, meta, stats, args.src_dir, args.output_dir, write_shared_compounds)

    print()
    print(f"Total compounds parsed: {stats['compounds_total']}")
    accent_pct = (
        100 * (stats["compounds_total"] - stats["compounds_no_accent"]) / stats["compounds_total"]
        if stats["compounds_total"] else 0
    )
    print(f"Compounds with pitch accent: {stats['compounds_total'] - stats['compounds_no_accent']} "
          f"({accent_pct:.1f}%)")
    print(f"Compound parse failures: {stats['parse_failures']}")
    if stats["parse_failure_samples"]:
        print("  samples:", stats["parse_failure_samples"][:5])
    if stats["no_readings"]:
        print("Kanji skipped for missing on/kun readings:")
        for level, chars in stats["no_readings"].items():
            print(f"  N{level}: {chars}")
    if stats["affix_only_fallback"]:
        print(f"Kanji with only bound (affix) readings, kept as-is for quiz: "
              f"{len(stats['affix_only_fallback'])} {stats['affix_only_fallback'][:10]}")


if __name__ == "__main__":
    main()
