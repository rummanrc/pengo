# Data tools

Small, dependency-free Node scripts (Node 18+, built-ins only) that **verify and
enrich the drill data against a dictionary** — they never modify the app itself.
Use them to catch reading typos and to gather candidate example words.

They read *facts* (readings, okurigana, example words) from **KANJIDIC2 / JMdict**
(© EDRDG, CC BY-SA 4.0 — see [`../CREDITS.md`](../CREDITS.md)). They do **not**
touch, and you must never copy, the example sentences or 熟語 selections from a
commercial くりかえし漢字ドリル / らくらくノート workbook — those are copyrighted.

| Script | Checks / produces | Data files it reads (default) |
| --- | --- | --- |
| `audit-readings.js` | kanji readings not attested by KANJIDIC (e.g. `生 "う.ま"` → should be `う.む`) | kanji files: `../../kanji/kyoiku-gradeN.json` |
| `audit-words.js` | word readings not attested by JMdict | word files: `../../words/kyoiku-wordsN.json` |
| `augment-words.js` | adds okurigana words (hoisted ahead of compounds — from each kanji's own `examples`) and attaches example sentences (exact target match across all grades, falling back to `jed-kanji-sentences.json` by substring) to `../../words/kyoiku-wordsN.json` | `../../kanji/kyoiku-gradeN.json` + all `../../sentences/*.json` |
| `generate-filler-sentences.js` | run after `augment-words.js` — mechanically templates a plain example sentence for any word still without one, from the word + its own `meaning` gloss (original text, not sourced from a dictionary/corpus), so every word ends up with `examples` | `../../words/kyoiku-wordsN.json` (in place) |
| `fetch-example-words.js` | `example-words-report.json` — candidate 例語 per kanji to curate | kanji files: `../../kanji/kyoiku-gradeN.json` |
| `fetch-examples-kanjialive.js` | backfills `examples` directly (no review file — see below) for kanji that don't have any yet | kanji files: `../../kanji/kyoiku-gradeN.json` |
| `jmdict.js` | shared JMdict parser (not run directly) | — |
| `validate-sentences.js` | structural checks on hand-written sentences (target-is-substring, reading format, duplicates, second-sentence-differs) | `../../kanji/kyoiku-gradeN.json` + `../../sentences/kyoiku-sentencesN.json` |

All defaults are relative to this repo (kanji-data); pass `--data <dir>` to
point any of the first four at a different repo's data (e.g. `../jlpt/data`).

## Online usage

By default (no `--kanjidic` / `--jmdict` argument) these tools fetch from
[kanjiapi.dev](https://kanjiapi.dev/), caching responses in
`scripts/kyoiku/.kanjiapi-*.json` (git-ignored, resumable). This needs
network, and a third-party API can be down (it has been) — so the offline
setup below is recommended.

## The complete offline setup (recommended — nothing to be down)

Download two EDRDG source files **once** (same CC BY-SA data credited in
[`../../CREDITS.md`](../../CREDITS.md)), then everything runs locally forever:

```bash
# one-time downloads
curl -O https://www.edrdg.org/kanjidic/kanjidic2.xml.gz && gunzip kanjidic2.xml.gz
curl -O http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz    && gunzip JMdict_e.gz

cd ~/github/kanji-data

# reading errors (kanji) — KANJIDIC2
node scripts/kyoiku/audit-readings.js --kanjidic ~/kanjidic2.xml
# reading errors (words) — JMdict
node scripts/kyoiku/audit-words.js    --jmdict   ~/JMdict_e
# example words to curate — JMdict → example-words-report.json
node scripts/kyoiku/fetch-example-words.js --jmdict ~/JMdict_e

# a sibling repo (e.g. ../jlpt) — just add --data:
node scripts/kyoiku/audit-readings.js      --kanjidic ~/kanjidic2.xml --data ../jlpt/data
node scripts/kyoiku/audit-words.js         --jmdict   ~/JMdict_e       --data ../jlpt/data
node scripts/kyoiku/fetch-example-words.js --jmdict   ~/JMdict_e       --data ../jlpt/data
```

(If a download URL 404s, the files are linked from the
[KANJIDIC](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) and
[JMdict](https://www.edrdg.org/jmdict/edict_doc.html) project pages — check there
for the latest version and update the URL.)

Approx sizes: KANJIDIC2 ~15 MB, JMdict_e ~35 MB gz / ~100 MB uncompressed.

## Handy arguments

- `--data <dir>` — audit another repo's data directory (default: this repo's
  `kanji/` for kanji-shaped scripts, `words/` for `audit-words.js`).
- `<name>` — filename-substring filter, e.g. `node scripts/kyoiku/audit-readings.js --kanjidic ~/kanjidic2.xml 1` runs only files containing `1` (kyoiku-grade1.json…).
- `fetch-example-words.js <name> <N>` — `N` = words per kanji (default 4), e.g. `… 1 6`.

## Notes

- **Memory**: `--jmdict` reads the ~100 MB XML into memory once. If Node ever
  OOMs, prefix with `node --max-old-space-size=4096 scripts/kyoiku/…`.
- **Reviewing output**: audit flags are *candidates* — most are typos, but a few
  may be rare readings the dictionary omits, so eyeball each against the
  kun/on/JMdict list printed beside it, then fix confirmed errors in
  `../../kanji/kyoiku-gradeN.json` / `../../words/kyoiku-wordsN.json`.
- **Example words**: `fetch-example-words.js` writes a **review** file, not a
  direct edit. Pick the words that reinforce the reading each grade teaches, add
  them to the data as an `examples` array (`{word, reading, gloss}` — kanji-drill
  already renders them on the answer reveal), and keep the JMdict attribution.
- **`fetch-examples-kanjialive.js`** backfills the same `examples` field
  directly, for any kanji that doesn't have one yet — it never touches an
  entry that already has examples. Unlike the JMdict tool above it skips the
  review step, because [Kanji alive](https://kanjialive.com)'s example lists
  are already hand-curated per kanji, not raw frequency-ranked dictionary
  output. Fetches its CSV over the network by default; pass `--csv <path>` to
  use a local copy instead. Covers 1,235 kanji (grades 1-6 plus the general
  jōyō set), so junior-high-only kanji (grades 7-9 here) are only partly
  covered — see the CC BY 4.0 attribution in [`../../CREDITS.md`](../../CREDITS.md).
