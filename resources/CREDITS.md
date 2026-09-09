# Credits & data attribution

## JMdict / KANJIDIC2 (`kanji/kanji_metadata.json`, `kanji/kanji_n{1-5}.csv`)

> This project uses the JMdict, KANJIDIC and related dictionary files. These
> files are the property of the [Electronic Dictionary Research and
> Development Group (EDRDG)](https://www.edrdg.org/), and are used in
> conformance with the Group's licence.

- Copyright © Electronic Dictionary Research and Development Group.
- Licence: **Creative Commons Attribution-ShareAlike 4.0 International
  (CC BY-SA 4.0)** — <https://creativecommons.org/licenses/by-sa/4.0/>
- EDRDG licence statement: <https://www.edrdg.org/edrdg/licence.html>
- KANJIDIC project: <https://www.edrdg.org/wiki/index.php/KANJIDIC_Project>

`kanji_metadata.json` additionally carries WaniKani-style level/meaning/
reading/radical fields (`wk_*`) layered on top of the KANJIDIC2 facts.
"WaniKani" is a product of [Tofugu / WaniKani](https://www.wanikani.com/);
this data is used for educational, non-commercial study purposes and this
project is not affiliated with or endorsed by WaniKani.

Because this data is CC BY-SA, redistributing it (or derived works) must
keep this attribution and remain under a compatible share-alike licence.

## KRADFILE (`radicals/kradfile`)

Kanji-to-radical decomposition table, originally compiled by Jim Rose at
Kanji Cafe (`KRADFILE2`), now maintained by EDRDG.

- Licence: EDRDG licence (as above), CC BY-SA 4.0-compatible.
- <https://www.edrdg.org/krad/kradinf.html>

## Tanaka Corpus (`sentences/examples.utf`)

Indexed example sentences, originally from the Tanaka Corpus
(<https://tatoeba.org/>), distributed by EDRDG as part of
`JMdict_e_examp.xml`. Used here in its original per-word-indexed form to
back the `sentence`/`kana`/`translation` columns in `kanji/kanji_n{1-5}.csv`.

- Licence: EDRDG licence (as above), CC BY-SA 4.0-compatible.

## Kanjium pitch-accent database (`compounds/accents_kanjium.txt`)

Word/reading → pitch-accent-kernel-position data, from the
[Kanjium](https://github.com/mifunetoshiro/kanjium) project by
mifunetoshiro. Used by `scripts/add_pitch_accent.py` to annotate compound
readings in `kanji/kanji_n{1-5}.csv` with their pitch accent. Kanjium does
not publish a formal licence file; it's widely reused by other
Japanese-study tooling (e.g. Yomichan/Yomitan) on an attribution basis —
verify current terms at the source repo before any redistribution beyond
this project's own apps.

## JMdict / KANJIDIC via kanjiapi.dev (`kanji/kyoiku-grade{1-9}.json`, `words/kyoiku-words{1-9}.json`)

> This project uses the JMdict, KANJIDIC and related dictionary files. These
> files are the property of the [Electronic Dictionary Research and
> Development Group (EDRDG)](https://www.edrdg.org/), and are used in
> conformance with the Group's licence.

- Copyright © Electronic Dictionary Research and Development Group.
- Licence: CC BY-SA 4.0 (as above).
- Fetched via the free [kanjiapi.dev](https://kanjiapi.dev/) service, which
  redistributes JMdict/KANJIDIC under the same licence — see
  `scripts/kyoiku/audit-readings.js`, `audit-words.js`,
  `fetch-example-words.js`.

## Kanji alive (some example words, `kanji/kyoiku-grade{1-9}.json`)

Where JMdict-based curation hadn't reached a kanji yet, its `examples` were
backfilled from the [Kanji alive](https://kanjialive.com) project's
language-data CSV via `scripts/kyoiku/fetch-examples-kanjialive.js`.

- Source: <https://github.com/kanjialive/kanji-data-media>
  (`language-data/ka_data.csv`)
- Copyright © Kanji alive.
- Licence: CC BY 4.0 — <https://creativecommons.org/licenses/by/4.0/>
  (attribution-only, unlike JMdict/KANJIDIC's share-alike above).

## Original content (`sentences/kyoiku-sentences{1-9}.json`)

Example sentences are original content written for this project, not
excerpts from any commercial textbook or dictionary corpus — each sentence
was written from scratch specifically to demonstrate its target kanji/word.

## KanjiVG (`stroke-order/kanjivg/`)

Stroke-order SVG diagrams. 2,136 of the 2,383 files here are mirrored from
the [jed](https://github.com/bagustris/jed) app's own data (jōyō kanji
only); the other 247 are fetched directly from
[KanjiVG upstream](https://github.com/KanjiVG/kanjivg) to cover JLPT N1's
non-jōyō (mostly 人名用漢字) kanji — same source and licence either way, not
KanjiVG's full ~11,000-character set.

- Copyright © Ulrich Apel — <http://kanjivg.tagaini.net/>
- Licence: **Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)**
  — <https://creativecommons.org/licenses/by-sa/3.0/>

## Tanaka Corpus + furigana (`sentences/jed-kanji-sentences.json`)

Per-kanji example sentences, mirrored here from jed's own data. Sourced
from EDRDG's `JMdict_e_examp.xml` (Tanaka Corpus, same family as
`sentences/examples.utf` above), with furigana readings added by jed's
`tools/build_furigana.py` from EDRDG's `examples.utf`.

- Licence: EDRDG licence (as above), CC BY-SA 4.0-compatible.

## What is NOT from any workbook

Kanji readings, meanings, and JLPT-level/grade assignments are language
facts taken from the dictionaries above (or MEXT's 学年別漢字配当表 for grade
assignments), not transcribed from any commercial workbook or app.

## License note

Any redistribution of this repo's `kanji/`, `radicals/`, `words/`,
`compounds/`, `sentences/`, or `stroke-order/` directories should carry
this file along with it.
