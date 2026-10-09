# Observed architecture decisions

These records describe choices evident in the current code. They are not reconstructed historical approvals. Each status is **Observed**, and the tradeoff discussion is an engineering interpretation recorded on 2026-10-07.

## D-01: Static runtime with hash routes

**Evidence:** `index.html`, `app.js` router, relative asset paths, and no frontend build script/backend.

Pengo delivers classic scripts and static data directly. This supports simple local hosting and a shared native asset package. The cost is a large application script, runtime-global dependencies, full dataset loading, and manual lifecycle management. A framework migration would need to preserve routes, offline packaging, and stored state rather than just visual appearance.

## D-02: Generated content plus fallback script bundle

**Evidence:** JSON builders, `build_bundle.py`, `loadData()`.

Content transformation happens offline; the runtime loads JSON normally and a duplicated script bundle on required-load failure. This supports local-file environments without runtime CSV/Anki/tokenizer dependencies. The cost is artifact duplication and a freshness contract: every content change must update the bundle. Source availability and stable IDs remain necessary for reproducible updates.

## D-03: One local progress store

**Evidence:** `STORE_KEY`, `defaultStore()`, `save()`, direct store backup.

Most user state is serialized into `knowkanji:v1`, with the onboarding flag separate. This makes offline export/import straightforward. The cost is whole-object writes, origin-specific storage, no conflict resolution/server recovery, whole-store write costs despite a visible failure notice, and shallow migration/validation. A future cloud feature must define merge semantics and privacy rather than assuming backups already provide sync.

## D-04: Pure course module over shared content/state

**Evidence:** `course.js` has no DOM/storage calls, accepts callbacks, exports CommonJS; app integration references existing records.

Curriculum, order, sampling, streaks, and milestones can be tested against actual code without a browser. The app owns grading/persistence. Derived curriculum avoids storing duplicate content, but source/pace changes can alter batch membership while numeric unlock position remains. Shared progress gives coherent cross-view state; pure-module tests do not validate integration effects.

## D-05: Java WebView shell for Android

**Evidence:** `MainActivity.java`, no native Capacitor dependency, APK staging scripts, manifest without internet permission.

The same static runtime runs inside a minimal Java activity, with a small bridge for backups/theme/version. This avoids requiring Node for the checked-in native build and supports offline assets. The cost is manual Back, lifecycle, document-picker, navigation security, and build/release maintenance. Optional Capacitor declarations are a separate path needing implementation.

## D-06: Kanji identity is the character

**Evidence:** `DB.byChar`, learned/note/favorite/SRS maps, overlapping level lists.

Progress naturally follows a character across levels. The cost is that detail indexes keep the later-level record and per-level counts are not distinct global counts. Vocabulary/grammar instead use generated level-qualified IDs with different stability concerns. Any redesign requires backup/ID migration and explicit decisions about shared versus per-level progress.

## D-07: Shared practice player and effort-based goals

**Evidence:** `practice.js`, `practice-ui.js`, shared `courseGrade`, practice unit/browser checks.

All quiz entry points now grade shared SRS and record real practice. Sessions contain 3/5/10 questions and persist compact references and feedback state. Mixed sessions cover available skills; due-only mode selects oldest due records and mistakes offer targeted follow-up. Goals count unique items attempted or newly studied each day, including wrong answers. Correct answers advance SRS at most once per local day, preventing retries from artificially increasing mastery. Recall ratings are explicitly self-rated. Motivation offers week activity, achievements, supportive return copy, and a clear stopping point; these are hypotheses to validate with learners, not measured learning-outcome claims.

## D-08: Original adventure identity with progressive practice choices

**Evidence:** `design.js`, adventure CSS, `practice-ui.js`, design browser checks.

The app uses a generated variant of its existing Pengo mascot, warm colors, a learning trail, and real-progress cards. Four short-session choices are immediately available; custom configuration is a disclosure, and saved sessions require an explicit resume/replacement choice. Decorative animation is finite and honors reduced motion. This adds personality and lowers setup effort while preserving reference/plan routes and shared learning state. Visuals and copy remain product hypotheses, with no measured retention claim. The generation prompt and asset are recorded in [design and reminders](design-and-reminders.md).

## D-09: Device opt-in reminders without a push backend

**Evidence:** `reminders.js`, `reminder-worker.js`, native reminder classes, manifest, unit/browser/native tests.

Native Android uses inexact OS alarms and receivers so reminders work independently of the WebView, with local clock/timezone restoration. Browser alerts use an open page plus a notification worker; calendar export offers a closed-app alternative. There is no remote push service. Permission follows explicit opt-in, daily alerts honor goals/duplicates and skip stale delivery, and device preferences stay outside progress backups. The tradeoffs are OS scheduling delays, browser suspension, and calendar alerts that cannot read Pengo goals. Native tests simulate lifecycle/permissions; physical-device delivery remains separate acceptance evidence.

## D-10: Local Japanese speech from dictionary readings

**Evidence:** `pronunciation.js`, `JapaneseSpeech.java`, speech integration/native tests.

The original implementation used installed offline Japanese speech from dictionary kana readings. D-11 supersedes this as the default with bundled neural audio; installed speech remains optional fallback. Buttons explicitly start playback, missing voices have recovery guidance, new requests replace older ones, and navigation/backgrounding stops speech. See [pronunciation](pronunciation.md).

## D-11: Bundled neural audio and date-scoped challenges (2026-10-08)

**Evidence:** `scripts/build_audio.py`, audio manifest/MP3s, `pronunciation.js`, `dashboard.js`, shared listening player, full-pack decoding, real-media checks, and APK inventory. **Status:** Observed and technically verified implementation; physical-device and assessment editorial acceptance remain separate.

Generate Kokoro Japanese speech during content preparation and ship compressed clips. This preserves offline playback and consistent voices without a runtime model or paid API, at the cost of bundle size and build-time generation. Device speech remains optional fallback; listening questions require completed bundled playback. Content-addressed readings and sentence IDs prepare the audio path for authored comprehension tests. Home derives per-subject totals and daily challenges from the existing activity ledger, so rewards reflect actual attempts and cannot diverge through separate completion toggles. Generated speech and engagement hypotheses still need learner/editorial review.

## Future decision record format

For a new architectural change, record ID/date, status (proposed/accepted/superseded), concrete context, chosen behavior, alternatives considered, state/route/content compatibility, consequences, reviewer/decision evidence, and related requirement/test IDs. Use [the review template](delivery/review-and-acceptance.md) when formal delivery records are needed.

## D-12: Text-only discovery cards and KanjiVG hierarchy (2026-10-09)

D-10 and the audio portion of D-11 are superseded: remove bundled speech, voice controls and native TTS to reduce size. Keep the date-scoped dashboard; challenges now open recall decks and use explicit, unique ratings. Use the existing KanjiVG Japanese group structure directly rather than importing an experimental graph or flat named WaniKani radicals. Preserve original KRADFILE content and mnemonic stories, expose larger/secondary groupings and matching story references separately. See [source research and implementation](discovery-cards.md).

## D-13: Separate learning confidence from quiz results (2026-10-09)

Cards support discovery and explicit learning confidence; quizzes assess recall and update SRS/mistakes/accuracy. Keep the compatible saved format/answer values, preserve both session slots, and add only an optional revealed cursor. Move full quiz controls into Learn, remove Review navigation, and redirect old bookmarks without creating history loops. Detail links carry validated deck context so the learner returns to the same card, including through related items and reload.
