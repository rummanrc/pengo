#!/usr/bin/env python3
"""Fill missing furigana in JLPT vocabulary examples with Sudachi.

Install the optional build-time dependency with:
    pip install sudachipy sudachidict_core
Then run:
    python scripts/sudachi_furigana.py [--check]

Existing ruby readings are kept unchanged. Sudachi is used only to annotate
uncovered kanji; its dictionary is not included in the app bundle.
"""
import argparse
import html
import json
import re
import sys
import unicodedata
from pathlib import Path

from sudachipy import dictionary, tokenizer as sudachi_tokenizer

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from furigana import word_to_ruby

DATA = ROOT / "data"
LEVELS = ["n5", "n4", "n3", "n2", "n1"]
RUBY_RE = re.compile(r"<ruby>(.*?)<rt>(.*?)</rt></ruby>", re.S)


def is_cjk(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or \
        (0xF900 <= o <= 0xFAFF) or (0x20000 <= o <= 0x2EBEF) or \
        ch in "々〆〇"


def hira(text):
    return "".join(chr(ord(ch) - 0x60) if 0x30A1 <= ord(ch) <= 0x30F6 else ch
                   for ch in text)


def normalized_positions(text):
    """Return NFKC text and a map from normalized offsets to original chars."""
    chars, positions = [], []
    for i, ch in enumerate(text):
        if ch.isspace():
            continue
        for normalized in unicodedata.normalize("NFKC", ch):
            chars.append(normalized)
            positions.append(i)
    return "".join(chars), positions


def ruby_ranges(furi, jp):
    flat, positions = normalized_positions(jp)
    cursor = 0
    ranges = []
    for match in RUBY_RE.finditer(furi or ""):
        base = re.sub(r"<[^>]*>", "", match.group(1))
        key = "".join(unicodedata.normalize("NFKC", ch) for ch in base if not ch.isspace())
        at = flat.find(key, cursor) if key else -1
        if at < 0:
            continue
        indices = positions[at:at + len(key)]
        if indices:
            ranges.append((min(indices), max(indices) + 1, match.group(0)))
            cursor = at + len(key)
    return ranges


def candidates(jp, tokenizer, mode):
    flat, positions = normalized_positions(jp)
    cursor = 0
    result = []
    for token in tokenizer.tokenize(jp, mode=mode):
        surface = token.surface()
        key = unicodedata.normalize("NFKC", surface)
        at = flat.find(key, cursor)
        if at < 0:
            continue
        indices = positions[at:at + len(key)]
        cursor = at + len(key)
        if not indices:
            continue
        start = min(indices)
        reading = hira(token.reading_form())
        if not reading or reading == "*":
            continue
        # Split modes may divide compounds into smaller reading units. Each
        # emitted kanji group keeps the analyzer's reading intact.
        original = jp[start:max(indices) + 1]
        if not any(is_cjk(ch) for ch in original):
            continue
        generated = word_to_ruby(original, reading)
        local_flat, local_positions = normalized_positions(original)
        local_cursor = 0
        for match in RUBY_RE.finditer(generated):
            base = re.sub(r"<[^>]*>", "", match.group(1))
            key = "".join(unicodedata.normalize("NFKC", ch) for ch in base)
            local_at = local_flat.find(key, local_cursor) if key else -1
            if local_at < 0:
                continue
            local_indices = local_positions[local_at:local_at + len(key)]
            if not local_indices:
                continue
            result.append((start + min(local_indices),
                           start + max(local_indices) + 1, match.group(0)))
            local_cursor = local_at + len(key)
    return result


def fill_partial_group(jp, start, end, markup, existing):
    """Use an analyzer reading's unambiguous edge when ruby covers one edge."""
    match = RUBY_RE.fullmatch(markup)
    if not match:
        return None
    base = re.sub(r"<[^>]*>", "", match.group(1))
    reading = re.sub(r"<[^>]*>", "", match.group(2))
    overlaps = [r for r in existing if r[0] < end and r[1] > start]
    if len(overlaps) != 1:
        return None
    old_start, old_end, old_markup = overlaps[0]
    old = RUBY_RE.fullmatch(old_markup)
    if not old:
        return None
    old_reading = re.sub(r"<[^>]*>", "", old.group(2))
    if old_start == start and old_end < end and reading.startswith(old_reading):
        remainder = jp[old_end:end]
        rd = reading[len(old_reading):]
    elif old_end == end and old_start > start and reading.endswith(old_reading):
        remainder = jp[start:old_start]
        rd = reading[:-len(old_reading)] if old_reading else reading
    else:
        return None
    if not remainder or not rd or not any(is_cjk(ch) for ch in remainder):
        return None
    return (start if old_start != start else old_end,
            old_start if old_end == end else end,
            "<ruby>%s<rt>%s</rt></ruby>" %
            (html.escape(remainder, quote=False), html.escape(rd, quote=False)))


def annotate_sentence(sent, tokenizer):
    jp = (sent.get("jp") or "").strip()
    if not jp:
        return 0, False
    furi = sent.get("furi") or ""
    existing = ruby_ranges(furi, jp)
    covered = set(i for start, end, _ in existing for i in range(start, end))
    additions = []
    modes = (sudachi_tokenizer.Tokenizer.SplitMode.C,
             sudachi_tokenizer.Tokenizer.SplitMode.B,
             sudachi_tokenizer.Tokenizer.SplitMode.A)
    for mode in modes:
        for start, end, markup in candidates(jp, tokenizer, mode):
            candidate = (start, end, markup)
            if any(i in covered for i in range(start, end)):
                candidate = fill_partial_group(jp, start, end, markup, existing)
                if not candidate:
                    continue
                start, end, _ = candidate
            if any(is_cjk(jp[i]) and i not in covered for i in range(start, end)):
                if not any(i in covered for i in range(start, end)):
                    additions.append(candidate)
                    covered.update(range(start, end))
    if not additions:
        return 0, False

    at_existing = {start: (end, markup) for start, end, markup in existing}
    at_addition = {start: (end, markup) for start, end, markup in additions}
    out, i = [], 0
    while i < len(jp):
        item = at_existing.get(i) or at_addition.get(i)
        if item:
            end, markup = item
            out.append(markup)
            i = end
        else:
            out.append(html.escape(jp[i], quote=False))
            i += 1
    sent["furi"] = "".join(out)
    return sum(sum(1 for ch in jp[start:end] if is_cjk(ch))
               for start, end, _ in additions), True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="report without writing data")
    args = parser.parse_args()
    tokenizer = dictionary.Dictionary().create()
    total, with_gaps, added_kanji, changed_files = 0, 0, 0, 0
    for level in LEVELS:
        path = DATA / ("vocab_%s.json" % level)
        items = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for vocab in items:
            for sent in vocab.get("sentences", []) or []:
                total += 1
                count, did_change = annotate_sentence(sent, tokenizer)
                if count:
                    with_gaps += 1
                    added_kanji += count
                changed = changed or did_change
        if changed and not args.check:
            path.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
            changed_files += 1
            print("wrote %s" % path.name)
    print("sentences scanned: %d; sentences supplemented: %d; kanji annotated: %d" %
          (total, with_gaps, added_kanji))
    if args.check:
        print("check only; no files written")
    else:
        print("files updated: %d" % changed_files)


if __name__ == "__main__":
    main()
