# Discovery cards and layered kanji components

Implemented 2026-10-09 (Asia/Tokyo).

## Text-only learning

Removed the bundled MP3 pack/manifest, pronunciation runtime and speaker controls, audio settings/previews, listening practice/quests, synthesis scripts/dependencies and native Japanese TTS bridge/service query. Old settings are stripped on startup/import; invalid listening sessions clear through existing validation. Previous learning, reviews, notes, favorites and history remain intact. Staging explicitly purges old audio folders/runtime files, including when `www` already exists.

## Daily cards

Daily challenges now show status without links: daily practice, a rotating subject, and three kanji discoveries. The latter counts distinct `kanji:id` recall ratings for the local day. Cards also work for vocabulary and grammar. The level sampler remains available with a small study-plan batch.

The front shows only the Japanese prompt. Tap or activate it by keyboard to flip; the back shows meaning and readings, then memory story, larger components, nested breakdowns and examples below. Explicit **Still learning** or **Got it** records learning effort exactly once. “Got it” marks an item studied and initializes its first review if needed. These choices do not grade SRS, count quiz attempts, or change mistakes. Reveal alone earns no progress. Got it advances directly to the next card or completion. After Still learning, swipe left, use Next, or press ArrowRight. Daily decks contain the exact remaining plan/goal count, up to ten cards, and finish with a learning summary; there is no automatic endless feed. Learning and quiz routes each resume their own saved format. Explicit flashcard/quiz links restore that format, preserving the other session in a paused slot. Practice offers an explicit replacement action within a format.

The inactive face is inert and hidden from assistive technology. Rating/advance controls stay hidden until appropriate. Reduced-motion users get an immediate reveal. Answered cards restore feedback after reload; an unrated reveal keeps its face through details navigation and reload. Older route/player handlers cannot grade a newer session.

## Source research and choice

- [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) combines KANJIDIC facts, JLPT classification and WaniKani information. It exposes `wk_radicals` as names, rather than a nested Japanese decomposition tree. Its repository uses MIT, but that alone does not clarify every upstream content field’s redistribution terms. No new WaniKani data was imported for this change.
- [davidluzgouveia/kanji-graph](https://github.com/davidluzgouveia/kanji-graph) derives component dependencies from KanjiVG. Its README explicitly marks it an early prototype with incomplete decompositions and data-quality issues; its [data license](https://github.com/davidluzgouveia/kanji-graph/blob/main/DATA-LICENSE.md) retains upstream attribution/share-alike requirements. We use the underlying source directly.
- [KanjiVG](https://github.com/KanjiVG/kanjivg), already bundled for stroke diagrams, provides [nested stroke groups](https://kanjivg.tagaini.net/svg-format.html), character/original/position/partial metadata and nonconsecutive part markers. This is the best fit for Japanese shape hierarchy without a new runtime dependency/download. © Ulrich Apel; CC BY-SA 3.0. The derived structure has attribution in its script header, component UI and `resources/CREDITS.md`, and retains that data license.

The new component source replaces flat KRADFILE as the primary structural view. KanjiVG is visual stroke structure; it is not a claim about historical etymology or a pedagogically validated mnemonic system. Groups that omit ungrouped strokes are labeled as partial explanations. Nonconsecutive portions merge; repeated independent components remain visible.

`build_components.py` extracts 2,211/2,211 trees and 1,809 sets of references from matching existing mnemonic stories. For **語**, the structural view starts at **言 + 吾**, with **吾 → 五 + 口** available below. The existing “Ego speaking words” story names **吾 (ego) + 言 (words)**; these stay together as compact cues in the Mnemonic section, while **五 + 口** remains an optional deeper view. Original KRADFILE arrays and content IDs are unchanged, and the smallest-part comparison remains available. Stories lacking explicit references retain their original component basis rather than being relabeled as a different breakdown.

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

### Learn and quiz separation — 2026-10-09

Learn now contains the library in three compact cards on one row, a learning-card entry, and four one-tap quiz subject choices with up to five questions. Due/mistake shortcuts appear for existing work. Saved quizzes can resume or be replaced after a new subject choice, while the latest ten quiz results display accessible score rings, subjects, levels and dates. Daily practice and achievements live in Progress. The standalone Review tab/page is removed; old URLs redirect with their parameters and replace their history entry. Home says “Discover one card at a time” / “Start learning”. Learning cards and quiz results keep separate meaning and saved progress. Existing historical results remain intact.

Detail exploration keeps a validated deck ID across kanji/vocabulary/grammar and related details. Returning restores the original cursor, revealed face and confidence/next controls, including after reload or while that deck is paused behind a quiz. Native/browser history Back also returns to the card. Ordinary/stale detail links retain their normal browse destinations.

Subject headings wrap and the grid gives long titles/counts enough room. Integration checks inspect actual element bounds as well as page overflow at 320/390/768/1024/1440px in both themes. See `tests/test_learn_browser.cjs` and the existing browser suites.

Verified: 310 browser checks across the Learn/access/discovery/practice/design/plan suites, full npm rules, syntax and diff checks passed. The open user tab verified the detail-return path and merged Learn controls. Docker APK assembly passed; all 16 checked runtime/data/credits files match their packaged bytes. Updated APK: 19,667,537 bytes (18.76 MiB); SHA-256 `eb8f6b4e77fda7db2ca989cd709f3294527dce35b3074fc591e56e727d7d96e9`.

### Daily learning simplification — 2026-10-09

Merged the first two intro slides into a JLPT-focused welcome. Home now has a compact direct-learning flashcard entry, status-only challenges and daily totals linking to a separate subject-filtered `#/today` item list. Removed the learning trail, daily practice eyebrow, overview explanation/footer and kanji-detail grammar card. Daily decks use the remaining current-batch items with a plan, or the remaining daily goal without one, in groups of at most ten; Keep learning starts another deck. Saved quizzes and decks remain independent.

Cards use compact flat faces, an explicit meaning, Japanese 音読み/訓読み labels, and available ruby furigana in examples for every subject. Got it advances immediately, including directly to completion on the last card. Still learning retains feedback and manual advance.

Verified: the full npm rules suite passed, along with 410 browser checks (98 daily-learning, 34 flashcard access, 72 Learn, 49 discovery, 46 practice, 40 design/reminder, 71 plan/settings). Button bounds at 320×568, 360×640 and 390×844 and tablet/desktop overflow pass in both themes. Intro, card and daily-list screenshots were reviewed. Syntax/diff checks and Docker APK assembly passed. All 16 checked runtime/data/credits files match the APK bytes. Local staging was refreshed. APK: 19,667,217 bytes; SHA-256 `140bdde6cf273bf0becfc8c01597655005655d729d14dca25ce9e7d577cb1523`. Physical Android-device interaction remains untested.

### Home focus and uniform recaps — 2026-10-09

The hero now starts/continues flashcards and invites more learning after the daily goal. Removed Home’s separate flashcard, playground and daily-practice cards; learning milestones now appear in Progress. Today’s subject totals use a connected vertical list linking to the daily item page. Pengo tips are removed and the Home greeting mascot stays still. The reminder suggestion hides when enabled and can be dismissed independently of notification permission, with device-local persistence.

All flashcard subjects share one Quick recap card. Kanji keeps meaning, Japanese reading labels, up to four larger shapes, its mnemonic, two example words and a furigana sentence; detailed component trees remain on item details. Incomplete challenges now open random cards for the remaining target, excluding items already counted today. A 1/3 grammar challenge starts two grammar cards. Larger daily challenges continue in decks of at most ten. A parked normal learning deck and a saved quiz survive challenge use, reload and backup import; completion or expiration restores normal learning.

Verified: npm rules and 473 browser checks passed (62 Home-refinement, 98 daily-learning, 72 Learn, 34 flashcard-access, 49 discovery, 41 design/reminder, 46 practice, 71 plan/settings). Home screenshots and list bounds pass at 320/390/768/1280px in both themes; the compact recap screenshots were reviewed. Syntax/diff checks and Docker APK assembly passed; 16 packaged source/data/credits files match the current bytes, and local staging was refreshed. APK: 19,669,041 bytes; SHA-256 `38fd94daa0a302ae7cb55d095284cd79e84db0766ad71d28f95b08116fa3d4d8`. Physical Android-device interaction remains untested.

### All-level exploration and restored flip — 2026-10-09

See [exploration refresh](exploration-refresh.md) for the current all-level read-only browsing contract, global/scoped searches, contextual Back buttons, rotating tap-to-flip cards, daily word invitation, and complete mascot assets. This supersedes the earlier flat-face player and level-restricted discovery behavior.
