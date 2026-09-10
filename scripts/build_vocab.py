"""Build normalized JLPT vocabulary data with Tatoeba example sentences.

Reads:
  resources/vocab/n5.csv ... n1.csv   (jmdict_seq,kana,kanji,waller_definition)
  resources/vocab/sentence_tatoeba/jp-eng-sentence-pairs.tsv  (jp_id, jp, en_id, en)

Writes:
  data/vocab_n5.json ... data/vocab_n1.json
  data/vocab_meta.json

Matching: exact-substring Aho-Corasick over the vocab surface form.
  - vocab with a kanji form containing CJK matches on the kanji form
  - kana-only vocab matches on kana only when len >= 3 (avoids 1-2 mora noise)
  - per vocab keep up to 3 shortest candidate sentences (deduped, length-capped)
Unmatched vocab keeps an empty sentences list (UI explains + links kanji).

Run:  python scripts/build_vocab.py
"""
import csv
import json
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "resources" / "vocab"
OUT = ROOT / "data"
LEVELS = ["N5", "N4", "N3", "N2", "N1"]
MAX_PER_VOCAB = 3
CAND_CAP = 8
MAX_JP_LEN = 90
MAX_EN_LEN = 170


def is_cjk(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or (0xF900 <= o <= 0xFAFF)


def split_meanings(raw):
    raw = (raw or "").strip()
    if not raw:
        return []
    parts = []
    for chunk in raw.replace(";", ",").split(","):
        c = " ".join(chunk.split())
        if c:
            parts.append(c)
    seen = []
    for p in parts:
        if p not in seen:
            seen.append(p)
    return seen[:6]


def load_vocab_rows(level):
    path = RES / ("n%s.csv" % level[1].lower())
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rows.append({
                "seq": (row.get("jmdict_seq") or "").strip(),
                "kana": (row.get("kana") or "").strip(),
                "kanji": (row.get("kanji") or "").strip(),
                "def": (row.get("waller_definition") or "").strip(),
            })
    return rows


def match_key(entry):
    k = entry["kanji"]
    if k and any(is_cjk(c) for c in k):
        return k
    kana = entry["kana"]
    if kana and len(kana) >= 3:
        return kana
    return None


def build_automaton(patterns):
    nxt = [{}]
    fail = [0]
    out = [[]]
    for vi, pat in patterns:
        state = 0
        for ch in pat:
            d = nxt[state]
            if ch not in d:
                d[ch] = len(nxt)
                nxt.append({})
                fail.append(0)
                out.append([])
            state = d[ch]
        out[state].append(vi)
    q = deque()
    for ch, s in nxt[0].items():
        fail[s] = 0
        q.append(s)
    while q:
        r = q.popleft()
        for ch, s in nxt[r].items():
            q.append(s)
            st = fail[r]
            while st and ch not in nxt[st]:
                st = fail[st]
            fail[s] = nxt[st].get(ch, 0)
            if out[fail[s]]:
                out[s] = out[s] + out[fail[s]]
    return nxt, fail, out


def load_sentence_pairs():
    path = RES / "sentence_tatoeba" / "jp-eng-sentence-pairs.tsv"
    pairs = {}
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.rstrip("\n").rstrip("\r")
            if not line:
                continue
            cols = line.split("\t")
            if len(cols) < 4:
                continue
            jp = cols[1].strip()
            en = cols[3].strip()
            if not jp or not en:
                continue
            if len(jp) > MAX_JP_LEN or len(en) > MAX_EN_LEN:
                continue
            if len(jp) < 2:
                continue
            if jp not in pairs:
                pairs[jp] = en
    return pairs


def main():
    entries_by_level = {}
    all_entries = []
    for lv in LEVELS:
        rows = load_vocab_rows(lv)
        seq_count = {}
        entries = []
        for row in rows:
            seq = row["seq"]
            n = seq_count.get(seq, 0)
            seq_count[seq] = n + 1
            vid = "%s-%s-%d" % (lv, seq or "x", n)
            meanings = split_meanings(row["def"])
            word = row["kanji"] if row["kanji"] else row["kana"]
            entries.append({
                "id": vid,
                "seq": seq,
                "word": word,
                "reading": row["kana"],
                "kanji": row["kanji"],
                "meaning": meanings[0] if meanings else "",
                "meanings": meanings,
                "jlpt": lv,
                "sentences": [],
            })
        entries_by_level[lv] = entries
        all_entries.extend(entries)
    print("vocab rows: %s" % ", ".join("%s=%d" % (lv, len(entries_by_level[lv])) for lv in LEVELS))

    patterns = []
    for vi, e in enumerate(all_entries):
        mk = match_key({"kanji": e["kanji"], "kana": e["reading"]})
        e["_key"] = mk
        if mk:
            patterns.append((vi, mk))
    print("matchable patterns: %d / %d" % (len(patterns), len(all_entries)))

    nxt, fail, out = build_automaton(patterns)
    pairs = load_sentence_pairs()
    print("tatoeba unique jp sentences (len<=%d): %d" % (MAX_JP_LEN, len(pairs)))

    cand = [[] for _ in all_entries]
    cand_seen = [set() for _ in all_entries]
    done = 0
    for jp, en in pairs.items():
        state = 0
        for ch in jp:
            while state and ch not in nxt[state]:
                state = fail[state]
            state = nxt[state].get(ch, 0)
            if out[state]:
                for vi in out[state]:
                    if len(cand[vi]) >= CAND_CAP:
                        continue
                    if jp in cand_seen[vi]:
                        continue
                    if jp == all_entries[vi]["_key"]:
                        continue
                    cand_seen[vi].add(jp)
                    cand[vi].append((jp, en))
    for vi, e in enumerate(all_entries):
        lst = cand[vi]
        lst.sort(key=lambda t: (len(t[0]), len(t[1])))
        e["sentences"] = [{"jp": jp, "en": en} for jp, en in lst[:MAX_PER_VOCAB]]
        del e["_key"]

    OUT.mkdir(exist_ok=True)
    meta = {"levels": {}, "total": 0, "withSentences": 0, "sentencePairs": len(pairs)}
    for lv in LEVELS:
        entries = entries_by_level[lv]
        with open(OUT / ("vocab_%s.json" % lv.lower()), "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False)
        ws = sum(1 for e in entries if e["sentences"])
        wk = sum(1 for e in entries if e["kanji"])
        meta["levels"][lv] = {"count": len(entries), "withSentences": ws, "withKanji": wk}
        meta["total"] += len(entries)
        meta["withSentences"] += ws
        print("wrote %s: %d vocab (%d with sentences, %d with kanji)" % (lv, len(entries), ws, wk))
    with open(OUT / "vocab_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("total vocab: %d (%d with sentences)" % (meta["total"], meta["withSentences"]))


if __name__ == "__main__":
    main()