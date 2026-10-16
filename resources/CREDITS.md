# Credits and licenses

Pengo's original application code, documentation, example text and project-authored
branding are licensed under **Apache-2.0**; see [LICENSE](../LICENSE) and
[NOTICE](../NOTICE). The third-party works below retain their own terms. The
application license does not relicense the bundled dictionaries or artwork.

## Dictionary facts and decomposition: EDRDG — CC BY-SA 4.0

This project uses the JMdict, KANJIDIC and related dictionary files. These files
are the property of the Electronic Dictionary Research and Development Group
and are used in conformance with the Group's licence.

- Copyright James William Breen and the Electronic Dictionary Research and Development Group.
- Source and licence: <https://www.edrdg.org/edrdg/licence.html>.
- Licence: <https://creativecommons.org/licenses/by-sa/4.0/>; local text:
  [CC-BY-SA-4.0](licenses/CC-BY-SA-4.0.txt).
- Files: dictionary-derived parts of `resources/kanji/`, `resources/words/`,
  `resources/compounds/`, `resources/radicals/kradfile`, `data/n1.json`–`n5.json`,
  `data/vocab_n1.json`–`vocab_n5.json`, and their bundled representations.
- Changes: JLPT filtering, schema conversion, reading selection, component links,
  dictionary-based furigana and deterministic Pengo memory-story templates.
- KRADFILE decomposition was originally compiled by Jim Rose / Kanji Cafe and is
  maintained by EDRDG: <https://www.edrdg.org/krad/kradinf.html>.

The metadata distribution is from David Luz Gouveia's
<https://github.com/davidluzgouveia/kanji-data>. Only dictionary facts and JLPT
classification are retained. All `wk_*` enrichment has been removed; Pengo does
not distribute WaniKani meanings, labels, readings or level data. Some grade/word
resources were retrieved through <https://kanjiapi.dev/>; underlying dictionary
terms remain EDRDG's. Dictionaries and derived dictionary data retain share-alike
terms independently of the Apache-licensed application.

## JLPT classification: Jonathan Waller — CC BY

Kanji/vocabulary level assignments and Waller-derived vocabulary glosses come
from Jonathan Waller's JLPT Resources: <https://www.tanos.co.uk/jlpt/>;
sharing terms: <https://www.tanos.co.uk/jlpt/sharing/>. These community study lists
are not official JLPT vocabulary/kanji lists.

Vocabulary source distribution and JMdict entry-ID alignment:
<https://github.com/stephenmk/yomitan-jlpt-vocab> (`original_data/n1.csv`–`n5.csv`).
The upstream attribution identifies Waller's Creative Commons Attribution terms.
Pengo preserves that attribution; dictionary-derived vocabulary remains subject
to EDRDG's CC BY-SA 4.0. Stable vocabulary IDs are not changed by the license cleanup.

## Sentences: Tanaka Corpus and Tatoeba contributors — CC BY 2.0 FR

Japanese/English example sentences come from the Tanaka Corpus / Tatoeba Project,
<https://tatoeba.org/>, including sentences distributed in EDRDG example files.
Copyright belongs to the respective Tatoeba contributors.

- Licence: <https://creativecommons.org/licenses/by/2.0/fr/>.
- Files: `resources/sentences/examples.utf`,
  `resources/sentences/jed-kanji-sentences.json`, sentence fields in the kanji
  CSVs, and Tatoeba-derived examples in runtime kanji/vocabulary JSON.
- Some kanji examples and furigana were obtained through
  <https://github.com/bagustris/jed>. Sentence copyright and attribution remain
  with the corpus contributors. Dictionary indexing/annotations retain EDRDG terms.
- Changes: selection, schema conversion, whitespace normalization and generated
  furigana. The original sentence data files are retained as available source.
- `resources/sentences/kyoiku-sentences*.json` contains project-authored examples
  under Apache-2.0, rather than extracts from textbooks.

## Kanji alive — CC BY 4.0

Copyright Kanji alive, <https://kanjialive.com/>. Data source and licence:
<https://github.com/kanjialive/kanji-data-media>, `LICENSE.md`.
Licence: <https://creativecommons.org/licenses/by/4.0/>; local text:
[CC-BY-4.0](licenses/CC-BY-4.0.txt).

Some examples in `resources/kanji/kyoiku-grade*.json` are from
`language-data/ka_data.csv`. Radical names/readings in
`resources/radicals/radicals_metadata.csv` are from
`language-data/japanese-radicals.csv`; the pinned source and transformations are
recorded in `resources/radicals/SOURCE.json`. Changes: selected columns and
compatibility field names. Kanji alive fonts, audio and animations are not bundled.

## Pitch accent: Kanjium — CC BY-SA 4.0

Pitch-accent additions are by Uros O. (mifunetoshiro), provided through the free
Kanjium database: <https://github.com/mifunetoshiro/kanjium>. Upstream README and
`LICENSE.txt` specify CC BY-SA 4.0. Underlying EDRDG and Tatoeba material retains
its attribution. Local licence: [CC-BY-SA-4.0](licenses/CC-BY-SA-4.0.txt).

Files: `resources/compounds/accents_kanjium.txt`, pitch-accent fields in kanji CSV
compounds. Changes: matching entries by word/reading and formatting accent values.

## Stroke diagrams and structural components: KanjiVG — CC BY-SA 3.0

Copyright Ulrich Apel and KanjiVG contributors, <https://kanjivg.tagaini.net/>;
source: <https://github.com/KanjiVG/kanjivg>. Licence:
<https://creativecommons.org/licenses/by-sa/3.0/>; local text:
[CC-BY-SA-3.0](licenses/CC-BY-SA-3.0.txt).

Files: all 2,383 SVGs in `resources/stroke-order/kanjivg/`, lazy script wrappers
in `data/strokes/`, and the structural trees/names in `data/components.js`.
Original SVG copyright/license comments are preserved. 2,136 SVGs were obtained
through the jed mirror and 247 directly from KanjiVG. Changes: lossless script
wrapping, hierarchy extraction, disconnected-group merging and dictionary fact
annotations. Structural derived data retains share-alike terms.

The former mnemonic CSV had no documented redistribution license and is removed.
Its text and story-reference labels are not in the release. Current memory
stories are generated from Pengo's own templates and licensed dictionary facts;
those stories are memory aids, not historical character etymologies.

## Grammar: Japanese Language Data — CC BY-SA 4.0

Copyright 2026 Justin Kindrix and contributors. Data from the Japanese Language
Data project, <https://github.com/jkindrix/japanese-language-data>, released under
<https://creativecommons.org/licenses/by-sa/4.0/>. Local licence:
[CC-BY-SA-4.0](licenses/CC-BY-SA-4.0.txt).

Only the project's original `grammar-curated/n1.json`–`n5.json` are used, not its
other aggregated datasets. The 595 notes and 1,787 Japanese/English example pairs
replace the former Anki deck, whose redistribution terms could not be established.
Source commit, SHA-256 hashes, upstream license and methodology are in
`resources/grammar/japanese-language-data/`. Runtime files are
`data/grammar_n1.json`–`grammar_n5.json` plus metadata and the offline bundle.

Changes: schema conversion, HTML escaping, dictionary-based furigana, related-ID
conversion and preservation of 141 unambiguously matched legacy IDs. Remaining
notes use new stable IDs; unmatched old progress stays in backups and is not
assigned to a different grammar point. The source notes are **community drafts**,
not independently certified grammar references. Converting them is not expert review.
The former deck's explanatory text, examples and audio are not distributed.

## Build-time reading tools

Some existing vocabulary readings were generated using SudachiPy and SudachiDict
Core. Neither the tokenizer nor its dictionary is shipped in the app. Source and
license information: <https://github.com/WorksApplications/SudachiPy> and
<https://github.com/WorksApplications/SudachiDict#licenses>. The new grammar builder
uses only checked-in dictionary/corpus readings with the repository's own helper.

Keep this file, the referenced license texts, original SVG notices and the grammar
source notice when redistributing the corresponding data. Store descriptions and
credit links do not replace the original authors' licenses or imply endorsement.
