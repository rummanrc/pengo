"""Offline furigana (ruby) annotator for kanji + vocab example sentences.

Same display contract as the grammar section: each sentence dict gains a
``furi`` field holding HTML with <ruby>base<rt>reading</rt></ruby> markup,
rendered by the app in a ``.ex-furi`` line under the plain ``jp`` text.

Method (fully offline, no new dependencies):
  - Build a surface -> reading dictionary from data already in the repo:
      1. data/vocab_n5..n1.json   (word -> reading, ~8k entries)
      2. data/n5..n1.json vocab[] (compound -> reading)
      3. data/grammar_n5..n1.json (parsed <ruby>base<rt>reading</rt></ruby>)
  - Conflicts resolve to the most-frequent reading.
  - Stem variants: for words with okurigana (e.g.食べる/たべる) also index
    the stem (食べ/たべ) so inflected forms (食べた) still match.
  - Annotate by longest-match left-to-right scan. Mixed kana/kanji words
    are split into per-kanji-run rubies (grammar style: 起/お + き).
  - Kanji runs with no dictionary entry are left as plain text (never
    guessed) so we never show a wrong reading.

Usage:
    python scripts/furigana.py            # rewrite data/n*.json + vocab_n*.json
    python scripts/furigana.py --check    # report coverage only

build_data.py / build_vocab.py import annotate() so rebuilds keep furi.
"""
import html
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

FURI_RE = re.compile(r"<ruby>(.*?)<rt>(.*?)</rt></ruby>", re.S)
TAG_RE = re.compile(r"<[^>]+>")


def is_cjk(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or \
        (0xF900 <= o <= 0xFAFF) or (0x20000 <= o <= 0x2EBEF) or ch in "々〆〇"


def is_kana(ch):
    o = ord(ch)
    return (0x3041 <= o <= 0x3096) or (0x30A1 <= o <= 0x30FA) or \
        (0xFF66 <= o <= 0xFF9D) or ch in "ー・＝"


def is_fullhalf_digit(ch):
    o = ord(ch)
    return (0x30 <= o <= 0x39) or (0xFF10 <= o <= 0xFF19)


def is_rubyable(ch):
    return is_cjk(ch) or is_fullhalf_digit(ch)


def esc(t):
    return html.escape(t, quote=False)


def has_cjk(s):
    return any(is_cjk(c) for c in s)


def trailing_kana_len(s):
    n = 0
    for ch in reversed(s):
        if is_kana(ch):
            n += 1
        else:
            break
    return n


def leading_kana_len(s):
    n = 0
    for ch in s:
        if is_kana(ch):
            n += 1
        else:
            break
    return n


def split_tokens(s):
    toks = []
    cur, kind = "", None
    for ch in s:
        k = "kanji" if is_rubyable(ch) else ("kana" if is_kana(ch) else "other")
        if k == kind:
            cur += ch
        else:
            if cur:
                toks.append((cur, kind))
            cur, kind = ch, k
    if cur:
        toks.append((cur, kind))
    return toks


def word_to_ruby(surface, reading):
    if not surface or not reading or surface == reading:
        return esc(surface)
    if not has_cjk(surface):
        return esc(surface)
    toks = split_tokens(surface)
    if len(toks) == 1 and toks[0][1] == "kanji":
        return "<ruby>%s<rt>%s</rt></ruby>" % (esc(surface), esc(reading))
    kana_toks = [t for t, k in toks if k == "kana"]
    if not kana_toks:
        return "<ruby>%s<rt>%s</rt></ruby>" % (esc(surface), esc(reading))
    cur = 0
    parts = []
    ok = True
    for idx, (tok, kind) in enumerate(toks):
        if kind == "other":
            parts.append(esc(tok))
            continue
        if kind == "kana":
            at = reading.find(tok, cur)
            if at != cur:
                ok = False
                break
            parts.append(esc(tok))
            cur += len(tok)
        else:
            nxt = None
            for t2, k2 in toks[idx + 1:]:
                if k2 == "kana":
                    nxt = t2
                    break
            if nxt is None:
                sl = reading[cur:]
            else:
                at = reading.find(nxt, cur)
                if at < 0:
                    ok = False
                    break
                sl = reading[cur:at]
            if not sl:
                ok = False
                break
            parts.append("<ruby>%s<rt>%s</rt></ruby>" % (esc(tok), esc(sl)))
            cur += len(sl)
    if not ok or cur != len(reading):
        return "<ruby>%s<rt>%s</rt></ruby>" % (esc(surface), esc(reading))
    return "".join(parts)


def _add(counter, surface, reading):
    surface = (surface or "").strip()
    reading = (reading or "").strip()
    if not surface or not reading or surface == reading:
        return
    if not has_cjk(surface):
        return
    if len(surface) > 24 or len(reading) > 48:
        return
    counter[(surface, reading)] += 1


def build_lookup():
    counts = Counter()
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        p = DATA / ("vocab_%s.json" % lv)
        try:
            items = json.load(open(p, encoding="utf-8"))
        except OSError:
            continue
        for e in items:
            _add(counts, e.get("word", ""), e.get("reading", ""))
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        p = DATA / ("%s.json" % lv)
        try:
            items = json.load(open(p, encoding="utf-8"))
        except OSError:
            continue
        for e in items:
            for v in e.get("vocab", []) or []:
                _add(counts, v.get("w", ""), v.get("r", ""))
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        p = ROOT / "resources" / "compounds" / ("jlpt-compounds-%s.json" % lv)
        try:
            items = json.load(open(p, encoding="utf-8"))
        except OSError:
            items = []
        for it in items:
            _add(counts, it.get("word", ""), it.get("reading", ""))
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        p = DATA / ("grammar_%s.json" % lv)
        try:
            items = json.load(open(p, encoding="utf-8"))
        except OSError:
            continue
        for g in items:
            for ex in g.get("examples", []) or []:
                furi = ex.get("furi", "") or ""
                for m in FURI_RE.finditer(furi):
                    base = TAG_RE.sub("", m.group(1)).strip()
                    rd = TAG_RE.sub("", m.group(2)).strip()
                    _add(counts, base, rd)
    best = {}
    freq = Counter()
    for (surf, rd), c in counts.items():
        if c > freq[surf]:
            freq[surf] = c
            best[surf] = rd
    stems = {}
    for surf, rd in list(best.items()):
        s2, r2 = surf, rd
        while len(s2) > 1 and len(r2) > 1 and is_kana(s2[-1]) and s2[-1] == r2[-1]:
            s2, r2 = s2[:-1], r2[:-1]
            if has_cjk(s2) and s2 not in best and s2 not in stems:
                stems[s2] = r2
        s3, r3 = surf, rd
        while len(s3) > 1 and len(r3) > 1 and is_kana(s3[0]) and s3[0] == r3[0]:
            s3, r3 = s3[1:], r3[1:]
            if has_cjk(s3) and s3 not in best and s3 not in stems:
                stems[s3] = r3
    for s2, r2 in stems.items():
        best.setdefault(s2, r2)
    max_len = max([len(s) for s in best] + [1])
    return best, min(max_len, 24)


_LOOKUP = None


def get_lookup():
    global _LOOKUP
    if _LOOKUP is None:
        _LOOKUP = build_lookup()
    return _LOOKUP


def annotate(jp, lookup=None, max_len=None):
    if not jp:
        return ""
    if lookup is None:
        lookup, max_len = get_lookup()
    out = []
    i, n = 0, len(jp)
    while i < n:
        if not is_rubyable(jp[i]):
            out.append(esc(jp[i]))
            i += 1
            continue
        hit = None
        for L in range(min(max_len, n - i), 0, -1):
            sub = jp[i:i + L]
            rd = lookup.get(sub)
            if rd is None:
                continue
            if L == 1:
                prev_ok = (i == 0) or (not is_rubyable(jp[i - 1]))
                next_ok = (i + 1 >= n) or (not is_rubyable(jp[i + 1]))
                if not (prev_ok and next_ok):
                    continue
            hit = (sub, rd, L)
            break
        if hit:
            out.append(word_to_ruby(hit[0], hit[1]))
            i += hit[2]
        else:
            out.append(esc(jp[i]))
            i += 1
    return "".join(out)


def annotate_sentence(sent, lookup=None, max_len=None):
    jp = (sent.get("jp") or "").strip()
    if not jp:
        return False
    if sent.get("furi"):
        plain = TAG_RE.sub("", sent["furi"]).replace(" ", "")
        if plain == jp.replace(" ", ""):
            return False
    sent["furi"] = annotate(jp, lookup, max_len)
    return True


def main():
    check_only = "--check" in sys.argv
    lookup, max_len = get_lookup()
    print("furigana dictionary: %d surfaces (max_len=%d)" % (len(lookup), max_len))
    changed_files = 0
    total_sent, ruby_sent = 0, 0
    # Grammar examples have their own curated furi markup (and often wrap
    # pieces of it in <b>). Preserve that markup, then annotate only the
    # uncovered parts of each sentence.
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        p = DATA / ("grammar_%s.json" % lv)
        try:
            items = json.load(open(p, encoding="utf-8"))
        except OSError:
            continue
        dirty = False
        for g in items:
            for ex in g.get("examples", []) or []:
                jp = (ex.get("jp") or "").strip()
                furi = ex.get("furi") or ""
                if not jp or not has_cjk(jp):
                    continue
                # Preserve emphasis boundaries while regenerating readings
                # from the JP sentence. Grammar source markup can have partial
                # ruby coverage, and retaining those readings risks duplicates
                # where the source furigana is stale.
                tags = []
                def mark_tag(m):
                    tags.append(m.group(0))
                    return "\u0000TAG%d\u0000" % (len(tags) - 1)
                marked = re.sub(r"</?(?:b|i)>", mark_tag, jp)
                updated = annotate(marked, lookup, max_len)
                for i, tag in enumerate(tags):
                    updated = updated.replace("\u0000TAG%d\u0000" % i, tag)
                if updated != furi:
                    ex["furi"] = updated
                    dirty = True
        if dirty and not check_only:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False)
            changed_files += 1
            print("wrote %s" % p.name)
    for lv in ["n5", "n4", "n3", "n2", "n1"]:
        for name in ("%s.json" % lv, "vocab_%s.json" % lv):
            p = DATA / name
            try:
                items = json.load(open(p, encoding="utf-8"))
            except OSError:
                continue
            dirty = False
            for e in items:
                for s in e.get("sentences", []) or []:
                    total_sent += 1
                    if "<ruby>" in (s.get("furi") or ""):
                        ruby_sent += 1
                        continue
                    if check_only:
                        continue
                    if annotate_sentence(s, lookup, max_len):
                        dirty = True
                        ruby_sent += 1
            if dirty and not check_only:
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(items, f, ensure_ascii=False)
                changed_files += 1
                print("wrote %s" % p.name)
    print("sentences: %d total, %d with ruby" % (total_sent, ruby_sent))
    if check_only:
        print("missing ruby: %d" % (total_sent - ruby_sent))
    else:
        print("files updated: %d" % changed_files)


if __name__ == "__main__":
    main()
