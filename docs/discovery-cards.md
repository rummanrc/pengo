# Discovery cards and layered kanji components

Implemented 2026-10-09 (Asia/Tokyo).

## Text-only learning

Removed the bundled MP3 pack/manifest, pronunciation runtime and speaker controls, audio settings/previews, listening practice/quests, synthesis scripts/dependencies and native Japanese TTS bridge/service query. Old settings are stripped on startup/import; invalid listening sessions clear through existing validation. Previous learning, reviews, notes, favorites and history remain intact. Staging explicitly purges old audio folders/runtime files, including when `www` already exists.

## Daily cards

All three daily challenge links use `format=recall`: daily mixed practice, a rotating subject sampler, and three kanji discoveries. The latter counts distinct `kanji:id` recall ratings for the local day. Cards also work for vocabulary and grammar. The level sampler remains available with a small study-plan batch.

The front shows only the Japanese prompt. Tap or activate it by keyboard to flip; the back shows meaning and readings, then memory story, larger components, nested breakdowns and examples below. Explicit **Need practice** or **Remembered** updates the existing SRS/activity ledger exactly once. Reveal alone earns no progress. After rating, swipe left on the card, use Next, or press ArrowRight. Three/five/ten-card sessions finish with the existing summary; there is no automatic endless feed. Generic start links resume active work. Explicit flashcard/quiz links restore that format, preserving the other session in a paused slot. Practice offers an explicit replacement action within a format.

The inactive face is inert and hidden from assistive technology. Rating/advance controls stay hidden until appropriate. Reduced-motion users get an immediate reveal. Answered cards restore feedback after reload; an unrated reveal resets to the front. Older route/player handlers cannot grade a newer session.

## Source research and choice

- [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) combines KANJIDIC facts, JLPT classification and WaniKani information. It exposes `wk_radicals` as names, rather than a nested Japanese decomposition tree. Its repository uses MIT, but that alone does not clarify every upstream content field’s redistribution terms. No new WaniKani data was imported for this change.
- [davidluzgouveia/kanji-graph](https://github.com/davidluzgouveia/kanji-graph) derives component dependencies from KanjiVG. Its README explicitly marks it an early prototype with incomplete decompositions and data-quality issues; its [data license](https://github.com/davidluzgouveia/kanji-graph/blob/main/DATA-LICENSE.md) retains upstream attribution/share-alike requirements. We use the underlying source directly.
- [KanjiVG](https://github.com/KanjiVG/kanjivg), already bundled for stroke diagrams, provides [nested stroke groups](https://kanjivg.tagaini.net/svg-format.html), character/original/position/partial metadata and nonconsecutive part markers. This is the best fit for Japanese shape hierarchy without a new runtime dependency/download. © Ulrich Apel; CC BY-SA 3.0. The derived structure has attribution in its script header, component UI and `resources/CREDITS.md`, and retains that data license.

The new component source replaces flat KRADFILE as the primary structural view. KanjiVG is visual stroke structure; it is not a claim about historical etymology or a pedagogically validated mnemonic system. Groups that omit ungrouped strokes are labeled as partial explanations. Nonconsecutive portions merge; repeated independent components remain visible.

`build_components.py` extracts 2,211/2,211 trees and 1,809 sets of references from matching existing mnemonic stories. For **語**, the structural view starts at **言 + 吾**, with **吾 → 五 + 口** available below. The existing “Ego speaking words” story names **吾 (ego) + 言 (words)**; these stay together in “Parts in your memory story,” while **五 + 口** remains an optional deeper view. Original KRADFILE arrays and content IDs are unchanged, and the smallest-part comparison remains available. Stories lacking explicit references retain their original component basis rather than being relabeled as a different breakdown.

## Build and verification

Regenerate after editing source SVGs or mnemonics:

```sh
python3 scripts/build_components.py
python3 scripts/sync_www.py
python3 scripts/build_apk_docker.py
```

The generator uses Python’s standard library and the existing fact helpers, with no network or new runtime packages. `data/components.js` loads through a classic script so file:// mode needs no extra fetch. See [testing](testing.md) for integration commands. Final check results and APK size are appended after verification.

### Verified result

- `npm test`: all Course (97), Practice (37), reminder (17), worker (7), and dashboard rule checks passed.
- Component extractor: five structural regression tests passed; all 2,211 roots match the original kanji IDs; regeneration produces identical bytes. Structural/story data occupies about 991 KiB.
- Browser integration: 49 discovery, 46 existing practice, and 40 design/reminder checks passed using isolated Chrome contexts. Light/dark screenshots at 320/390/768/1280px were visually reviewed. Card examples skip known corpus index markup.
- Native Android unit tests: 26 reminder cases passed in the Docker toolchain. Final APK assembly succeeded. No physical-device interaction test was performed.
- Source, `www`, local Android assets and final APK contain no speech pack/pronunciation runtime. ZIP inventory confirms every current runtime script, HTML, CSS and credits file matches the packaged bytes. Original level content and IDs are unchanged.
- Final `dist/pengo-debug.apk`: 19,659,793 bytes (18.75 MiB), down from 89.02 MiB (78.9% reduction). SHA-256: `cbfc71416edc44f0e93c9447f5f8393fe2051c65669a709f6af59270b1f9eebf`.

The transient “missing runtime file: components.js” Docker error occurred while the packaging list had been edited before its file was created. All referenced runtime files now exist, and the completed Docker build verifies the fix.

### Discoverability fix — 2026-10-09

Reproduced in the user’s open tab: a daily recall link silently resumed a saved multiple-choice quiz. Added a named Flashcards hub and visible Home/Learn/Review entries. Format switching now preserves the other unfinished session instead of overriding the requested practice style. The user’s quiz remained saved while a kanji card opened and flipped successfully.

`test_flashcards_browser.cjs` covers named entry points, saved-quiz/card swapping, reload/backup persistence, completion, level isolation, vocabulary/grammar cards, and phone/desktop layouts.

Verified: 33 flashcard-access checks, 46 existing practice checks, 49 discovery checks and 71 study-plan/settings checks passed. Pure practice rules now include paused-session backup normalization (38 checks); the full npm suite passes. The open user tab was verified through a real challenge click, card reveal and preserved-quiz resume control. Docker APK assembly passed; all runtime scripts, HTML and styles match the final ZIP inventory. Updated APK: 19,666,149 bytes; SHA-256 `050cd98ff2dbbec871a562ab56734bb6c310a512ecf171d229660ce0b2a52e67`.
