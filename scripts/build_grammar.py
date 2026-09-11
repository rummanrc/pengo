"""Build normalized JLPT grammar data from the Anki source deck.

Reads (read-only source, never modified):
  resources/grammar/Japanese_Core_Grammar_JLPT_N5-N1_waudio.apkg

Writes:
  data/grammar_n5.json ... data/grammar_n1.json
  data/grammar_meta.json

Source deck layout (verified by inspection):
  1 deck ("Japanese Core Grammar JLPT N5-N1"), 1 note type, 400 notes.
  Fields: Grammar | JLPT Level | Frequency | Sentence | Sentence Furigana |
          Sentence Translation | Grammar Explanation | Notes | Audio
  Media inside the apkg is hypertts-*.mp3 TTS audio only: intentionally
  excluded, nothing audio-related ships to the app. No license metadata
  found in the package.

Normalization:
  - One entry per (JLPT, grammar point); same-level duplicates merge
    their examples and keep the first explanation.
  - <br>-separated multi-examples are split and aligned across the three
    sentence fields at build time.
  - Furigana bracket notation (KANJI[reading]) becomes <ruby> HTML.
  - Explanation exp-section divs become [{label, html}], sanitized down
    to text plus <b>/<i>/<br>.
  - Related points: known point names found in Similar-Grammar sections.

Run:  python scripts/build_grammar.py
"""
import html
import json
import os
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APKG = ROOT / "resources" / "grammar" / "Japanese_Core_Grammar_JLPT_N5-N1_waudio.apkg"
OUT = ROOT / "data"
LEVELS = ["N5", "N4", "N3", "N2", "N1"]

FIELD_NAMES = ["Grammar", "JLPT Level", "Frequency", "Sentence",
               "Sentence Furigana", "Sentence Translation",
               "Grammar Explanation", "Notes", "Audio"]

BR_RE = re.compile(r"<br\s*/?>", re.I)
TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*?(/?)>")
WS_RE = re.compile(r"[ \t\xa0\u3000]+")
SEC_RE = re.compile(
    r"<div[^<>]*class=\"exp-section\"[^<>]*>"
    r"\s*<span[^<>]*class=\"exp-label\"[^<>]*>(.*?)</span>(.*?)</div>",
    re.S)
FURI_RE = re.compile(r"([^\s<>\[\]]+?)\[([^\[\]<>]+)\]")
ALLOWED_TAGS = {"b", "i", "br"}


def sanitize_html(raw):
    text = html.unescape(raw or "")

    def keep(m):
        close, name, selfclose = m.group(1), m.group(2).lower(), m.group(3)
        if name not in ALLOWED_TAGS:
            return ""
        if name == "br":
            return "<br>"
        return "</%s>" % name if close else "<%s>" % name

    parts = []
    pos = 0
    for m in TAG_RE.finditer(text):
        parts.append(html.escape(text[pos:m.start()], quote=False))
        parts.append(keep(m))
        pos = m.end()
    parts.append(html.escape(text[pos:], quote=False))
    return "".join(parts)


def plain_text(raw):
    text = BR_RE.sub("\n", raw or "")
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    lines = []
    for line in text.split("\n"):
        line = WS_RE.sub(" ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def one_line(raw):
    return WS_RE.sub(" ", plain_text(raw).replace("\n", " ")).strip()


def furigana_html(raw):
    safe = sanitize_html(BR_RE.sub(" ", raw or ""))
    return FURI_RE.sub(lambda m: "<ruby>%s<rt>%s</rt></ruby>" % (m.group(1), m.group(2)), safe)


def split_examples(sent, furi, trans):
    s = [x.strip() for x in BR_RE.split(sent or "") if x.strip()]
    f = [x.strip() for x in BR_RE.split(furi or "") if x.strip()]
    t = [x.strip() for x in BR_RE.split(trans or "") if x.strip()]
    out = []
    for i in range(max(len(s), len(f), len(t))):
        jp = one_line(s[i]) if i < len(s) else ""
        fu = furigana_html(f[i]) if i < len(f) else ""
        en = one_line(t[i]) if i < len(t) else ""
        if jp or en:
            out.append({"jp": jp, "furi": fu, "en": en})
    return out


def parse_sections(expl_raw):
    sections = []
    for m in SEC_RE.finditer(expl_raw or ""):
        label = one_line(m.group(1))
        body = sanitize_html(m.group(2)).strip()
        body = re.sub(r"(<br>\s*)+", "<br>", body).strip(" <br>")
        if label and body:
            sections.append({"label": label, "html": body})
    if not sections and one_line(expl_raw):
        sections.append({"label": "Explanation", "html": sanitize_html(expl_raw)})
    return sections


def load_notes():
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(APKG) as z:
            names = z.namelist()
            dbname = "collection.anki21" if "collection.anki21" in names else "collection.anki2"
            z.extract(dbname, tmp)
            con = sqlite3.connect(os.path.join(tmp, dbname))
            try:
                col = con.execute("SELECT models, decks FROM col").fetchone()
                models = json.loads(col[0])
                decks = json.loads(col[1])
                deck_names = [d.get("name", "") for d in decks.values() if d.get("name") != "Default"] or ["Japanese Core Grammar JLPT N5-N1"]
                model = next(iter(models.values()))
                fields = [f["name"] for f in model.get("flds", [])]
                idx = {name: fields.index(name) for name in FIELD_NAMES}
                rows = con.execute("SELECT flds FROM notes ORDER BY rowid").fetchall()
            finally:
                con.close()
    return rows, idx, deck_names


def main():
    assert APKG.is_file(), "missing source deck: %s" % APKG
    rows, idx, deck_names = load_notes()
    print("deck: %s | notes: %d" % (" / ".join(deck_names), len(rows)))

    grouped = {}
    order = []
    unclassified = 0
    for n, (flds,) in enumerate(rows):
        parts = flds.split("\x1f")
        point = one_line(parts[idx["Grammar"]])
        jlpt = one_line(parts[idx["JLPT Level"]]).upper()
        if jlpt not in LEVELS or not point:
            unclassified += 1
            continue
        freq = one_line(parts[idx["Frequency"]])
        examples = split_examples(parts[idx["Sentence"]], parts[idx["Sentence Furigana"]],
                                  parts[idx["Sentence Translation"]])
        sections = parse_sections(parts[idx["Grammar Explanation"]])
        meaning = ""
        for sec in sections:
            if sec["label"].lower() == "meaning":
                meaning = one_line(sec["html"])
                break
        key = (jlpt, point)
        if key in grouped:
            g = grouped[key]
            seen = {(e["jp"], e["en"]) for e in g["examples"]}
            for e in examples:
                if (e["jp"], e["en"]) not in seen:
                    seen.add((e["jp"], e["en"]))
                    g["examples"].append(e)
            g["sourceNotes"].append(n)
        else:
            grouped[key] = {
                "point": point, "jlpt": jlpt, "frequency": freq,
                "meaning": meaning, "sections": sections,
                "examples": examples, "related": [], "sourceNotes": [n],
            }
            order.append(key)

    points = {key: grouped[key]["point"] for key in order}
    names = sorted({g["point"] for g in grouped.values()}, key=len, reverse=True)
    for key in order:
        g = grouped[key]
        sim_text = " ".join(
            one_line(s["html"]) for s in g["sections"]
            if "similar" in s["label"].lower() or "differen" in s["label"].lower())
        if not sim_text:
            continue
        rel = []
        for name in names:
            if name == g["point"]:
                continue
            pat = re.compile(r"%s(?![\u3040-\u30ff\u4e00-\u9fff])" % re.escape(name))
            if pat.search(sim_text):
                rel.append(name)
                if len(rel) >= 8:
                    break
        g["related"] = rel

    by_level = {lv: [] for lv in LEVELS}
    for key in order:
        by_level[key[0]].append(grouped[key])
    for lv in LEVELS:
        by_level[lv].sort(key=lambda g: g["sourceNotes"][0])
        for i, g in enumerate(by_level[lv], 1):
            g["id"] = "%s-%03d" % (lv, i)

    OUT.mkdir(exist_ok=True)
    meta = {"levels": {}, "total": 0, "withExamples": 0,
            "examples": 0, "frequencies": {}, "unclassified": unclassified,
            "source": {"file": APKG.name, "deck": " / ".join(deck_names),
                       "notes": len(rows), "audioExcluded": True}}
    for lv in LEVELS:
        entries = by_level[lv]
        with open(OUT / ("grammar_%s.json" % lv.lower()), "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False)
        nex = sum(len(g["examples"]) for g in entries)
        wex = sum(1 for g in entries if g["examples"])
        for g in entries:
            meta["frequencies"][g["frequency"]] = meta["frequencies"].get(g["frequency"], 0) + 1
        meta["levels"][lv] = {"count": len(entries), "withExamples": wex, "examples": nex}
        meta["total"] += len(entries)
        meta["withExamples"] += wex
        meta["examples"] += nex
        print("wrote %s: %d entries (%d with examples, %d examples)" % (lv, len(entries), wex, nex))
    with open(OUT / "grammar_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("total grammar: %d (%d unclassified skipped)" % (meta["total"], unclassified))


if __name__ == "__main__":
    main()