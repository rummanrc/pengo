# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not yet follow semantic version tags; entries are
grouped chronologically until a first release is cut.

## [Unreleased]

### Changed
- `kanji/kyoiku-gradeN.json`: readings now encode their type in their script —
  on'yomi in katakana, kun'yomi in hiragana — classified against KANJIDIC2
  across all nine grades (2,107 readings rewritten). Eleven kun'yomi also had
  their okurigana boundary normalized (後 うしろ → うし.ろ, 交 まじ.る →
  ま.じる, 向 むか.う → む.かう, 確 たしか.める → たし.かめる, 混 まざ.る →
  ま.ざる, 暮 くら.す → く.らす, 入 いり → い.り, ...); a dot the data already
  recorded is never dropped, even where KANJIDIC also lists a bare form
  (巻 ま.き stays). Word and sentence files are unchanged: their readings are
  furigana, which is always hiragana.

### Added
- 12 readings attested by an entry's own `examples` but missing from its
  `readings` (grades 3-9 only: 遊 ユ, 帯 お.びる, 冊 サク, 押 オウ, ...), found
  by segmenting each example word's reading against KANJIDIC2 with
  rendaku/gemination variants and keeping the reading actually used.

### Fixed
- `kanji/kyoiku-grade2.json`: merged the duplicate 分 entry (there were two
  分 records, making the file 161 entries) into a single 160-char entry; the
  set now exactly matches the official Kyōiku kanji grade-2 list (160 kanji).
  Also corrected 分's meaning ("one" → "divide; part").

## [0.2.0] - 2026-08-27  

## Added 
- ~555 new okurigana entries and example sentences attached to ~1430 words.

## [0.1.0] - 2026-08-26

### Added
- `stroke-order/kanjivg/`: fetched the 247 non-jōyō kanji used by JLPT N1
  (mostly 人名用漢字 name-kanji) directly from KanjiVG upstream, closing the
  gap left by jed's jōyō-only mirror. `stroke-order/kanjivg/` is now 2,383
  files, with 0 missing kanji across JLPT N1-N5 and kyoiku grades 1-9.
  This 247-file set is additively maintained and separate from the jed
  mirror; refreshing from jed must merge (`cp -n`), not replace.
- `compounds/`: new data domain for JLPT compound words
  (`jlpt-compounds-n{1-5}.json`), dual-written by `export_jlpt_web.py`;
  also carries the raw `accents_kanjium.txt`.
- `jed/data/kanjivg/` (2,136 stroke-order SVGs) and
  `jed/data/kanji-sentences.json` (per-kanji example sentences) mirrored
  from jed — the two pieces of its data portable to other apps without
  jed's ~120MB JMdict search stack. Manually refreshed, not migrated; see
  README.md for the refresh recipe.
- kanji-drill's `data/` (grade/words/sentences, 27 files) and its
  JMdict/kanjiapi.dev/Kanji-Alive-backed `tools/` mirrored in, preserving
  kanji-drill's own internal layout.
- Initial scaffold: `kanji_metadata.json`, JLPT-graded CSVs, radicals
  metadata, and their build scripts, moved out of kanji-slideshow as the
  first source consolidated into this repo.

### Changed
- Reorganized by data domain instead of by source app: dissolved the
  app-named `kanji-drill/` and `jed/` directories in favor of top-level
  `kanji/`, `radicals/`, `words/`, `compounds/`, `sentences/`, and
  `stroke-order/`, plus `scripts/kyoiku/` for kanji-drill's tooling
  (renamed `grade{1-9}.json`/`words{1-9}.json` to
  `kyoiku-grade{1-9}.json`/`kyoiku-words{1-9}.json`; updated the tools'
  internal default data-dir paths for the new split).

### Fixed
- `export_jlpt_web.py`: only dual-write
  `compounds/jlpt-compounds-n{1-5}.json` when `--src-dir` is the canonical
  default, so pointing `--src-dir` at a draft/test CSV set no longer
  silently overwrites the shared file with non-canonical data.
- `enrich_kanji_csv.py`: a bare CSV filename passed positionally now
  resolves against `kanji/` like the no-arg default, instead of the CWD
  (which no longer contains the CSVs after the data-domain moves).
- `.gitignore`: cover `scripts/kyoiku/`'s network-mode caches and
  `fetch-example-words.js`'s report output, plus a `/data/` guard against
  `export_jlpt_web.py`'s `--output-dir` default when run bare from this
  repo's own root.
