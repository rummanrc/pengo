"""Build KnowKanji web data files from resources/ (kanji-data submodule).

Reads JLPT CSVs, kanji_metadata.json, kradfile, radicals_metadata.csv,
jlpt-compounds-*.json and jed-kanji-sentences.json, then writes
data/n5.json ... data/n1.json, data/radicals.json and data/meta.json.

Run:  python scripts/build_data.py
"""
import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "resources"
OUT = ROOT / "data"
STROKE_DIR = RES / "stroke-order" / "kanjivg"
LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# kradfile convention: these stand in for another component (variant forms).
VARIANT_OF = {
    "\u5316": "\u4eba",   # kradfile writes the person radical as ?
    "\u4ebb": "\u4eba",
    "\u6c35": "\u6c34",
    "\u624c": "\u624b",
    "\u5fc4": "\u5fc3",
    "\u72ad": "\u72ac",
    "\u2ebe": "\u8279",
    "\u7af9": "\u7af9",
    "\u98df": "\u98df",
    "\u8864": "\u8863",
    "\u793a": "\u793a",
    "\u7f72": "\u7f51",
    "\u5202": "\u5200",
    "\u961d": "\u961c",
    "\u2edc": "\u9ecd",
    "\u2ece": "\u9091",
}

def std_char(c):
    return unicodedata.normalize("NFKC", c)


def load_metadata():
    with open(RES / "kanji" / "kanji_metadata.json", encoding="utf-8") as f:
        return json.load(f)


def load_radicals():
    radicals = {}
    with open(RES / "radicals" / "radicals_metadata.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                num = int(row["Radical ID#"])
            except (ValueError, TypeError):
                continue
            ch = std_char(row["Radical"].strip())
            radicals[ch] = {
                "n": num,
                "char": ch,
                "meaning": (row.get("Meaning") or "").strip(),
                "reading": (row.get("Reading-R") or "").strip(),
            }
    return radicals


def load_kradfile():
    table = {}
    try:
        f = open(RES / "radicals" / "kradfile", encoding="euc-jp", errors="replace")
    except OSError:
        return table
    with f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            if ":" not in line:
                continue
            left, right = line.split(":", 1)
            kanji = left.strip().replace("\uff1a", "")
            if len(kanji) != 1:
                continue
            comps = [t for t in right.strip().split() if len(t) == 1]
            if comps:
                table[kanji] = comps
    return table


def load_compounds():
    index = {}
    for lv in LEVELS:
        path = RES / "compounds" / ("jlpt-compounds-%s.json" % lv.lower())
        try:
            items = json.load(open(path, encoding="utf-8"))
        except OSError:
            continue
        for it in items:
            for k in it.get("sourceKanji", []) or []:
                index.setdefault(k, []).append({
                    "w": it.get("word", ""),
                    "r": it.get("reading", ""),
                    "m": it.get("meaning", ""),
                })
    return index


def load_sentences():
    try:
        data = json.load(open(RES / "sentences" / "jed-kanji-sentences.json",
                              encoding="utf-8"))
    except OSError:
        return {}
    out = {}
    for k, lst in data.items():
        keep = []
        for s in (lst or [])[:3]:
            if isinstance(s, dict) and s.get("jp"):
                keep.append({"jp": s.get("jp", ""),
                             "en": s.get("en", "")})
        if keep:
            out[k] = keep
    return out


def strip_mnemonic_html(text):
    text = (text or "").strip()
    text = re.sub(r"<u[^>]*>(.*?)</u>", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    import html as _html
    text = _html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def load_mnemonics():
    path = RES / "mnemonics.csv"
    out = {}
    try:
        f = open(path, encoding="utf-8-sig")
    except OSError:
        return out
    with f:
        for row in csv.DictReader(f):
            ch = (row.get("CHARACTER") or "").strip()
            raw = (row.get("MNEMONIC") or "").strip()
            if len(ch) != 1 or not raw or raw == "-":
                continue
            clean = strip_mnemonic_html(raw)
            if clean and ch not in out:
                out[ch] = clean
    print("loaded mnemonics.csv: %d entries" % len(out))
    return out


def clean_meaning(text):
    text = (text or "").strip().lower()
    text = re.sub(r",?\s*[^,()]*\bradical\b[^,()]*(\([^)]*\))?", "", text)
    text = re.sub(r"\s+", " ", text).strip(" ,;")
    first = [p.strip() for p in text.split(",") if p.strip()]
    return first[0] if first else text


def split_readings(raw, meta):
    on, kun = [], []
    if raw:
        parts = raw.split(";")
        if len(parts) >= 1:
            on = [x.strip().strip(".") for x in parts[0].split(",") if x.strip()]
        if len(parts) >= 2:
            kun = [x.strip().lstrip("!") for x in parts[1].split(",") if x.strip()]
    if not on and meta.get("readings_on"):
        on = [x.lstrip("!") for x in meta["readings_on"]]
    if not kun and meta.get("readings_kun"):
        kun = [x.lstrip("!") for x in meta["readings_kun"]]
    return on, kun


def parse_csv_compounds(raw):
    out = []
    for chunk in (raw or "").split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*=\s*(.+)$", chunk)
        if m:
            word, rd, meaning = m.groups()
            rd = rd.split("\u00b7")[0].strip()
            out.append({"w": word.strip(), "r": rd, "m": meaning.strip()})
        else:
            out.append({"w": chunk, "r": "", "m": ""})
    return out

MNEMONIC_T2 = [
    "A {a} trips over {b} in the middle of a crowded street. The whole crowd gasps: that is {meaning}!",
    "{A} throws a wild party and invites {b}. Things get completely out of hand, and the neighbors remember the night as pure {meaning}.",
    "Picture {a} giving {b} an enormous bear hug. That warm, ridiculous collision is the very image of {meaning}.",
    "{A} challenges {b} to a sumo match and wins by a landslide. The trophy is engraved with one word: {meaning}.",
    "A {a} opens a tiny shop selling {b}. The sign above the door says {meaning}, and customers line up around the block.",
]
MNEMONIC_T3 = [
    "{A}, {b} and {c} start a chaotic band together. Their debut hit single is titled {meaning}.",
    "Stack {a} on {b} on {c} like a wobbly pancake tower. Step back and admire your {meaning} before it topples over.",
    "{A} introduces {b} to {c} at a noisy summer festival. That unforgettable meeting is {meaning}.",
]
MNEMONIC_T1 = [
    "Zoom in on {a} until it fills the whole sky. That single giant image burns {meaning} into your memory.",
    "{A} strikes a dramatic hero pose and shouts: I am {meaning}! Applaud loudly so you never forget it.",
    "One lonely {a} dreams of becoming something greater. One morning it wakes up as {meaning}.",
]
MNEMONIC_TN = [
    "Toss {items} into a blender, hit maximum speed, and pour out a steaming bowl of {meaning}.",
    "Line up {items} for a group photo. The photographer shouts {meaning}! Everybody grins.",
]


def pick(template_list, key):
    h = 0
    for ch in key:
        h = (h * 31 + ord(ch)) % 1000003
    return template_list[h % len(template_list)]


def make_mnemonic(kanji, meaning, comp_meanings, on, kun):
    meaning = meaning or kanji
    words = [w for w in comp_meanings if w]
    ctx = {"meaning": meaning}
    if words:
        ctx["a"] = words[0]
        ctx["A"] = words[0][:1].upper() + words[0][1:] if words[0] else words[0]
    if len(words) == 1:
        story = pick(MNEMONIC_T1, kanji).format(**ctx)
    elif len(words) == 2:
        ctx.update({"b": words[1], "B": words[1][:1].upper() + words[1][1:]})
        story = pick(MNEMONIC_T2, kanji).format(**ctx)
    elif len(words) == 3:
        ctx.update({"b": words[1], "c": words[2]})
        story = pick(MNEMONIC_T3, kanji).format(**ctx)
    elif len(words) > 3:
        if len(words) > 2:
            items = ", ".join(words[:-1]) + " and " + words[-1]
        else:
            items = words[0]
        ctx["items"] = items
        story = pick(MNEMONIC_TN, kanji).format(**ctx)
    else:
        story = "Stare at %s until it tells you its name: %s. It just did." % (kanji, meaning)
    reading = (on[:1] + kun[:1])
    if reading:
        story += " Chant %s while picturing the scene." % reading[0]
    return story


def component_info(c, dataset, metadata, radicals):
    std = std_char(c)
    parent = VARIANT_OF.get(c) or VARIANT_OF.get(std)
    key = parent or std
    rec = dataset.get(key)
    meta = metadata.get(key, {})
    rad = radicals.get(key) or radicals.get(std)
    if rec:
        meaning = rec["meaning"]
    elif meta.get("meanings"):
        meaning = clean_meaning(meta["meanings"][0])
    elif rad:
        meaning = rad["meaning"]
    else:
        meaning = ""
    return {
        "c": c,
        "m": meaning,
        "rad": rad["n"] if rad else None,
        "isKanji": bool(rec or meta),
        "link": key if (rec and key != c) or (rec and parent) else (key if rec else None),
        "variantOf": parent,
    }

def build_level(level, metadata, radicals, krad, compounds, sentences, dataset, mnemonics=None):
    path = RES / "kanji" / ("kanji_%s.csv" % level.lower())
    out = []
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            k = (row.get("kanji") or "").strip()
            if len(k) != 1:
                continue
            meta = metadata.get(k, {})
            meanings_raw = [m.strip() for m in (row.get("meaning") or "").split(",") if m.strip()]
            primary = clean_meaning(meanings_raw[0]) if meanings_raw else clean_meaning((meta.get("meanings") or [""])[0])
            on, kun = split_readings(row.get("readings") or "", meta)
            comps = krad.get(k)
            if not comps:
                comps = [t for t in (row.get("radicals") or "").split() if len(t.strip()) == 1]
            comp_infos = [component_info(c, dataset, metadata, radicals) for c in comps]
            comp_meanings = [ci["m"] for ci in comp_infos]
            vocab = list(compounds.get(k, [])) or parse_csv_compounds(row.get("compounds") or "")
            vocab = vocab[:6]
            sents = []
            if (row.get("sentence") or "").strip():
                sents.append({"jp": row["sentence"].strip(),
                              "ro": (row.get("kana") or "").strip(),
                              "en": (row.get("translation") or "").strip()})
            for s in sentences.get(k, []):
                if len(sents) >= 4:
                    break
                if s["jp"] not in [x["jp"] for x in sents]:
                    sents.append({"jp": s["jp"], "ro": "", "en": s["en"]})
            confus = [c.strip() for c in (row.get("confusables") or "").split(",") if c.strip()][:8]
            cp = "%05x" % ord(k)
            strokes = meta.get("strokes")
            out.append({
                "k": k, "meaning": primary, "meanings": meanings_raw[:5],
                "on": on[:6], "kun": kun[:8],
                "strokes": strokes, "grade": meta.get("grade"),
                "freq": meta.get("freq"), "jlpt": level,
                "components": comp_infos,
                "vocab": vocab, "sentences": sents[:4],
                "confusables": confus,
                "hasStroke": (STROKE_DIR / (cp + ".svg")).exists(),
                "cp": cp,
                "mnemonic": (mnemonics.get(k) if mnemonics and mnemonics.get(k) else make_mnemonic(k, primary, comp_meanings, on, kun)),
            })
    return out


def main():
    metadata = load_metadata()
    radicals = load_radicals()
    krad = load_kradfile()
    compounds = load_compounds()
    sentences = load_sentences()
    mnemonics = load_mnemonics()
    dataset = {}
    for lv in LEVELS:
        path = RES / "kanji" / ("kanji_%s.csv" % lv.lower())
        with open(path, encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                k = (row.get("kanji") or "").strip()
                if len(k) == 1 and k not in dataset:
                    first = (row.get("meaning") or "").split(",")[0]
                    dataset[k] = {"meaning": clean_meaning(first), "level": lv}
    OUT.mkdir(exist_ok=True)
    meta = {"levels": {}, "total": 0, "strokeCoverage": {}}
    for lv in LEVELS:
        items = build_level(lv, metadata, radicals, krad, compounds, sentences, dataset, mnemonics)
        with open(OUT / ("%s.json" % lv.lower()), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False)
        covered = sum(1 for it in items if it["hasStroke"])
        meta["levels"][lv] = {"count": len(items), "stroke": covered}
        meta["total"] += len(items)
        meta["strokeCoverage"][lv] = covered
        print("wrote %s: %d kanji (%d with stroke art)" % (lv, len(items), covered))
    with open(OUT / "radicals.json", "w", encoding="utf-8") as f:
        json.dump(sorted(radicals.values(), key=lambda r: r["n"]), f, ensure_ascii=False)
    with open(OUT / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("total kanji:", meta["total"])



# ---- Correct Kangxi radical numbering (overrides file-local IDs above) ----
KANGXI_214 = (
    "\u4e00\u4e28\u4e36\u4e3f\u4e59\u4e85"  # 1-6
    "\u4e8c\u4ea0\u4eba\u513f\u5165\u516b\u5182\u5196\u51ab"  # 7-15
    "\u51e0\u51f5\u5200\u529b\u52f9\u5315\u531a\u5338"  # 16-23
    "\u5341\u535c\u5369\u5382\u53b6\u53c8"  # 24-29
    "\u53e3\u56d7\u571f\u58eb\u5902\u590a\u5915\u5927\u5973\u5b50"  # 30-39
    "\u5b80\u5bf8\u5c0f\u5c22\u5c38\u5c6e\u5c71\u5ddb\u5de5\u5df1"  # 40-49
    "\u5dfe\u5e72\u5e7a\u5e7f\u5ef4\u5efe\u5f0b\u5f13\u5f50\u5f61\u5f73"  # 50-60
    "\u5fc3\u6208\u6236\u624b\u652f\u6534\u6587\u6597\u65a4\u65b9"  # 61-70
    "\u65e0\u65e5\u66f0\u6708\u6728\u6b20\u6b62\u6b79\u6bb3\u6bcb"  # 71-80
    "\u6bd4\u6bdb\u6c0f\u6c14\u6c34\u706b\u722a\u7236\u723b\u723f"  # 81-90
    "\u7247\u7259\u725b\u72ac\u7384\u7389\u74dc\u74e6\u7518\u751f"  # 91-100
    "\u7528\u7530\u758b\u7592\u7676\u767d\u76ae\u76bf\u76ee\u77db"  # 101-110
    "\u77e2\u77f3\u793a\u79b8\u79be\u7a74\u7acb"  # 111-117
    "\u7af9\u7c73\u7cf8\u7f36\u7f51\u7f8a\u7fbd\u8001\u800c\u8012"  # 118-127
    "\u8033\u807f\u8089\u81e3\u81ea\u81f3\u81fc\u820c\u821b\u821f"  # 128-137
    "\u826e\u8272\u8278\u864d\u866b\u8840\u884c\u8863\u897e"  # 138-146
    "\u898b\u89d2\u8a00\u8c37\u8c46\u8c55\u8c78\u8c9d\u8d64\u8d70"  # 147-156
    "\u8db3\u8eab\u8eca\u8f9b\u8fb0\u8fb5\u9091\u9149\u91c6\u91cc"  # 157-166
    "\u91d1\u9577\u9580\u961c\u96b6\u96b9\u96e8\u9751\u975e"  # 167-175
    "\u9762\u9769\u97cb\u97ed\u97f3\u9801\u98a8\u98db\u98df\u9996\u9999"  # 176-186
    "\u99ac\u9aa8\u9ad8\u9adf\u9b25\u9b2f\u9b32\u9b3c"  # 187-194
    "\u9b5a\u9ce5\u9e75\u9e7f\u9ea5\u9ebb"  # 195-200
    "\u9ec3\u9ecd\u9ed1\u9ef9\u9efd\u9f0e\u9f13\u9f20"  # 201-208
    "\u9f3b\u9f4a\u9f52\u9f8d\u9f9c\u9fa0"  # 209-214
)
assert len(KANGXI_214) == 214, len(KANGXI_214)
KANGXI_NUM = {ch: i + 1 for i, ch in enumerate(KANGXI_214)}
SHINJI_TO_TRAD = {"\u7adc": "\u9f8d", "\u4e80": "\u9f9c", "\u9ea6": "\u9ea5",
                  "\u9ec4": "\u9ec3", "\u9ed2": "\u9ed1", "\u6b6f": "\u9f52"}
ATOMIC_T = [
    "{A} is a foundation stone of written Japanese: a basic building block that simply is {meaning}. Picture it carved in glowing rock.",
    "No assembly required: {a} just means {meaning}. Whisper {meaning} three times while tracing the shape in the air.",
    "Meet {a} in its purest form. It stands for nothing else; it simply is {meaning}. Give it a nod of respect.",
]


def kangxi_number(ch):
    ch = SHINJI_TO_TRAD.get(ch, ch)
    return KANGXI_NUM.get(ch)


def load_radicals():
    info = {}
    try:
        with open(RES / "radicals" / "radicals_metadata.csv", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                ch = std_char((row.get("Radical") or "").strip())
                if ch and ch not in info:
                    info[ch] = {"meaning": (row.get("Meaning") or "").strip(),
                                "reading": (row.get("Reading-R") or "").strip()}
    except OSError:
        pass
    out = []
    for i, ch in enumerate(KANGXI_214):
        extra = info.get(ch, {})
        out.append({"n": i + 1, "char": ch,
                    "meaning": extra.get("meaning", ""),
                    "reading": extra.get("reading", "")})
    return {r["char"]: r for r in out}


def make_mnemonic(kanji, meaning, comp_meanings, on, kun):
    meaning = meaning or kanji
    words = [w for w in comp_meanings if w]
    ctx = {"meaning": meaning}
    if words:
        ctx["a"] = words[0]
        ctx["A"] = words[0][:1].upper() + words[0][1:] if words[0] else words[0]
    if len(words) == 1 and words[0].lower() == meaning.lower():
        story = pick(ATOMIC_T, kanji).format(**ctx)
    elif len(words) == 1:
        story = pick(MNEMONIC_T1, kanji).format(**ctx)
    elif len(words) == 2:
        ctx.update({"b": words[1]})
        story = pick(MNEMONIC_T2, kanji).format(**ctx)
    elif len(words) == 3:
        ctx.update({"b": words[1], "c": words[2]})
        story = pick(MNEMONIC_T3, kanji).format(**ctx)
    elif len(words) > 3:
        items = ", ".join(words[:-1]) + " and " + words[-1]
        ctx["items"] = items
        story = pick(MNEMONIC_TN, kanji).format(**ctx)
    else:
        story = "Stare at %s until it tells you its name: %s. It just did." % (kanji, meaning)
    reading = (on[:1] + kun[:1])
    if reading:
        story += " Chant %s while picturing the scene." % reading[0]
    return story


def component_info(c, dataset, metadata, radicals):
    std = std_char(c)
    parent = VARIANT_OF.get(c) or VARIANT_OF.get(std)
    key = parent or std
    rec = dataset.get(key)
    meta = metadata.get(key, {})
    if rec:
        meaning = rec["meaning"]
    elif meta.get("meanings"):
        meaning = clean_meaning(meta["meanings"][0])
    else:
        rinfo = radicals.get(key) or radicals.get(std)
        meaning = rinfo["meaning"] if rinfo else ""
    num = kangxi_number(key) or kangxi_number(std)
    if rec:
        link = parent or (std if std != c else key)
        link = key
    else:
        link = None
    return {
        "c": c,
        "m": meaning,
        "rad": num,
        "isKanji": bool(rec or meta),
        "link": link,
        "variantOf": parent,
    }
if __name__ == "__main__":
    main()
