# Testing and acceptance

## Android 1.0.2 release — 2026-10-20

The latest master snapshot passed `npm test`, `npm run test:content`, 37 Chrome
writing checks and 60 Home checks. Docker unsigned release assembly, all 26
Android JUnit/Robolectric tests and `lintRelease` passed; lint has zero errors
and seven warnings. APK inspection confirms stable application identity,
version `1.0.2`/`3`, min/target SDK 24/34 and no internet permission. All 2,522
staged runtime/notice files match packaged bytes. Exact F-Droid CI metadata
schema validation passed. Public-tag source-recipe and GitLab CI results are
recorded in [F-Droid release status](fdroid.md). Physical-device and signed
upgrade acceptance remain separate.

## Guided kanji writing — 2026-10-18

`npm test` includes 22 geometry assertions in `tests/test_writing.cjs`: uneven
input frequency/finger jitter, reversed strokes (including tiny dots), incomplete
and oversized strokes, incorrect placement, curved hooks, shortcuts, scribbles
and malformed input. The real-browser suite uses bundled 三/永/一 paths rather
than fixture drawings:

```sh
python3 scripts/sync_www.py
# Serve the root at http://127.0.0.1:8000 in a separate terminal.
NODE_PATH=/tmp/pengo-qa/node_modules node tests/test_writing_browser.cjs
NODE_PATH=/tmp/pengo-qa/node_modules PENGO_TEST_ENGINE=webkit PENGO_TEST_ARTIFACTS=/tmp/pengo-writing-webkit-qa node tests/test_writing_browser.cjs
```

Use an external Playwright install with Chrome and the Playwright WebKit browser.
The suite checks real touch and pen input in Chrome, mouse drawing in both
engines, order/direction/partial-stroke rejection, undo/restart/close, cancellation,
multiple pointers, rotation, final grading, unchanged study state, exploration
outside the plan, navigation reset, reduced motion, missing diagrams and fallback
loading. It inspects overflow at 320/390/768/1440px in both themes and saves card
screenshots. Native packages include both new runtime scripts through the shared
staging inventory. Desktop WebKit blocks `file://` JSON reads; this test explicitly
allows those known access-control reports and verifies successful tracing through
the script fallback. The iOS app uses its existing `pengo://` origin instead.

Verified on 2026-10-18: the complete npm suite passed, including 22 writing
geometry checks; Chrome and WebKit each passed 37 writing checks, and the
existing search/stroke suite passed 72 checks. Light/dark card screenshots were
inspected. Android Docker debug assembly, iOS simulator and unsigned device IPA
builds passed; the iOS bridge/Foundation suite passed 31 Foundation checks.
The five changed runtime files match source bytes in both native staging trees,
the APK, the simulator app and the IPA. Physical-device tracing was not tested.

Physical Android/iOS finger/stylus acceptance remains separate: open any kanji,
tap Writing practice, trace from the numbered start, intentionally reverse and
skip strokes, undo/restart, rotate, and finish the character in airplane mode.
Check that ordinary scrolling works outside the square and that existing
learning/quiz progress is unchanged. Grading checks approximate guided shape;
it is not freehand handwriting recognition or a calligraphy assessment.

## Pengo rename and F-Droid preparation — 2026-10-16

`npm test` now also exercises real startup storage migration and the renamed
native JavaScript bridge. Ten migration checks cover preserved progress/settings,
new-key precedence, retry after persistence failure, malformed input, unavailable
storage and subsequent saves/reloads. Run the browser tutorial suite to verify
first-launch detection using `PengoNative` and real learning after the tour.

Verified during preparation: the npm suite passed (97 Course, 39 Practice, 17
Reminders, 7 worker checks, Dashboard, 10 migration checks and native bridge
checks); the tutorial browser suite passed 361 checks. Seven additional actual
browser checks verified migration, dark-theme preservation, reload persistence
and confirmed erasure without resurrecting legacy progress. All 26 renamed
Android JUnit/Robolectric tests passed; `assembleDebug` and `lintRelease` passed.
Lint reported 12 existing launcher-icon/unused-resource warnings and no errors.
`npm run test:ios` passed bridge checks and 31 Foundation checks after staging.

The Docker unsigned release build succeeded. Store screenshots depict the shared
runtime rendered in Chrome at 390×844 CSS pixels (2× output); they are not physical
Android-device captures. Physical-device acceptance, a two-version signed native
upgrade and official store publication remain unverified. Local `fdroidserver`
validation is recorded below. See [F-Droid preparation](fdroid.md) for publication status.

## Licensed content replacement — 2026-10-16

The unlicensed mnemonic CSV and Anki-deck text are retired. Runtime grammar now
contains 595 source-pinned, CC BY-SA 4.0 notes with 1,787 examples from Japanese
Language Data. Source notes retain their draft review status. Dictionary metadata
excludes WaniKani enrichment, and the refresh tool filters it. Current mnemonics
come from original Pengo templates; KanjiVG structure is preserved.

`npm run test:content` passes four provenance/removal/bundle tests and five
component extraction tests. The full npm suite passes. Browser checks pass for
practice (46), study plan/settings (71), discovery (49), dictionary/details (82),
and tutorial (361): 609 checks total. The 26 native tests, debug assembly and
release lint were repeated after content replacement and pass. The final unsigned
release contains 2,520 runtime/notice files verified against current source bytes.

`fdroidserver` 2.4.5 metadata parsing/lint and source scanning have passed in the
Docker validation toolchain, using official F-Droid category names. The local source-recipe build also succeeded. Verification uses a temporary Git
snapshot and the installed Gradle 8.7,
rather than public GitHub source. This is not acceptance by F-Droid maintainers.
Historical content sanitization is complete, preserving all 44 commits and their
parent relationships. Only the approved bundled-content paths changed; the release
tree remained identical. The sanitized source is now public.

## F-Droid checksum follow-up — 2026-10-18

Gradle 8.7's binary-distribution SHA-256 was fetched from its official service and
pinned in the wrapper properties. Android/shared runtime version is `1.0.1`,
version code `2`. The `v1.0.0` tag remains unchanged.

`fdroidserver` 2.4.5 metadata parsing/lint, source scanning and release assembly
passed using a clone of the public `v1.0.1` tag, commit
`8938efde22da0e580ae221f07cc3a742396fd695`. All 2,520 APK runtime/notice files match
source. The unsigned APK has SHA-256
`b78e63015b56d4d98fe8c4ece42ee28d3c3d7b9b1c79aa8333cb170a56bc1234`.
APK metadata confirms the expected application ID, version, SDK range and no
internet permission. The canonical full-hash recipe with author attribution
also passes metadata lint. No behavior changes or new physical-device test are
claimed. After account verification, the first runnable pipeline exposed a schema
error in `AutoUpdateMode`. The corrected `AutoUpdateMode: Version` passes the
schema from the failing CI revision and local lint. [Pipeline #2959785745](https://gitlab.com/snowski/fdroiddata/-/pipelines/2959785745)
then passed all nine jobs, including APK assembly/inspection, schema validation,
metadata checks and source checks, for metadata commit
`96fbf7928e19f8f308cd9498678044e7d16e7e91`. Official store acceptance remains pending.

## Coverage today

`tests/test_course.py` evaluates the actual `course.js` plus two JavaScript drivers in dukpy. This snapshot executes **97 assertions**, covering dates/exam generation, pace, daily splits, curriculum coverage, unlocking, streaks, sampling, progress, milestones, defaults, ordering, schedule states, and greetings.

Daily practice adds 37 pure-logic checks and an optional browser persistence/SRS integration suite. Design/reminder checks add 17 reminder rules, 7 worker checks, 40 browser checks, and 26 native JUnit/Robolectric tests. Physical-device Android instrumentation, CI, and a formatter are still absent. Manual procedures below fill those gaps; they are not claims that every procedure has been run.

## iOS checks and acceptance

Run `npm run test:ios` on macOS with Swift command-line tools, Python 3, and Node. It compiles/runs 31 Foundation checks for reminder dates, DST, goal suppression, local paths, traversal, and symlink rejection, plus JavaScript checks for bridge payloads, cached permission reads, Android/iOS detection, and native/browser onboarding. It does not build UIKit/WebKit. Full Xcode compilation, simulator execution, and physical iPhone acceptance remain outstanding; follow the [iOS checklist](ios.md#verification-and-remaining-acceptance).

## Existing harness

```sh
python3 -m venv /tmp/pengo-test-venv
/tmp/pengo-test-venv/bin/python -m pip install dukpy
/tmp/pengo-test-venv/bin/python tests/test_course.py
```

Success prints `course.js tests: 97 passed, 0 failed` for the inspected drivers. Failures return exit one and list names. Missing dukpy prints `SKIP` and returns zero; inspect output before treating the result as validation.

## Node alternative

This runs the same driver strings against the same source, using Node's VM. It was used for the documentation verification because dukpy was unavailable; it does not prove dukpy-engine compatibility.

```sh
python3 - <<'PY'
from pathlib import Path
import runpy
import subprocess

tests = runpy.run_path('tests/test_course.py')
source = Path('course.js').read_text(encoding='utf-8')
source += tests['DRIVER'] + tests['DRIVER2']
runner = '''
const vm = require('node:vm');
let source = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => source += chunk);
process.stdin.on('end', () => {
  const result = JSON.parse(vm.runInNewContext(source));
  console.log(JSON.stringify(result));
  process.exitCode = result.failures.length ? 1 : 0;
});
'''
subprocess.run(['node', '-e', runner], input=source, text=True, check=True)
PY
```

The drivers inject deterministic random callbacks for relevant sampling checks. Preserve meaningful invariants such as complete coverage, no repeated selected IDs, and bounded/default allocations when extending tests.

## Syntax checks

Node can check JavaScript syntax without running browser code:

```sh
node --check app.js
node --check course.js
node --check practice.js
node --check practice-ui.js
node --check components.js
node --check recall-ui.js
node --check design.js
node --check reminders.js
node --check reminder-worker.js
node --check platform.js
node --check onboarding.js
```

For Python syntax without writing bytecode into the repo:

```sh
python3 - <<'PY'
import ast
from pathlib import Path
for path in list(Path('scripts').glob('*.py')) + list(Path('tests').glob('*.py')):
    ast.parse(path.read_text(encoding='utf-8-sig'), filename=str(path))
print('Python syntax OK')
PY
```

## Data and bundle consistency

This read-only check validates counts, per-level IDs, declared stroke files, and fallback parity. It intentionally permits kanji overlap between levels.

```sh
python3 - <<'PY'
import json
from pathlib import Path

root = Path('.')
data = root / 'data'
bundle_text = (data / 'bundle.js').read_text(encoding='utf-8')
prefix = 'window.KK_DATA = '
assert bundle_text.startswith(prefix) and bundle_text.endswith(';')
bundle = json.loads(bundle_text[len(prefix):-1])
levels = ['N5', 'N4', 'N3', 'N2', 'N1']
for stem, key, meta_name, id_key in [
    ('', 'levels', 'meta', 'k'),
    ('vocab_', 'vocab', 'vocab_meta', 'id'),
    ('grammar_', 'grammar', 'grammar_meta', 'id'),
]:
    meta = json.loads((data / (meta_name + '.json')).read_text())
    total = 0
    for level in levels:
        rows = json.loads((data / (stem + level.lower() + '.json')).read_text())
        assert rows == bundle[key][level], (stem, level, 'bundle differs')
        assert len(rows) == meta['levels'][level]['count']
        assert len({row[id_key] for row in rows}) == len(rows)
        assert all(row['jlpt'] == level for row in rows)
        if key == 'levels':
            covered = 0
            for row in rows:
                path = root / 'resources/stroke-order/kanjivg' / (row['cp'] + '.svg')
                assert row['cp'] == format(ord(row['k']), '05x')
                assert path.is_file() == row['hasStroke'], str(path)
                covered += int(row['hasStroke'])
            assert covered == meta['levels'][level]['stroke']
        total += len(rows)
    assert total == meta['total']
    assert meta == bundle[meta_name]
radicals = json.loads((data / 'radicals.json').read_text())
assert radicals == bundle['radicals']
assert [row['n'] for row in radicals] == list(range(1, 215))
print('Content counts, IDs, stroke files, radicals, and bundle parity OK')
PY
```

These checks do not judge linguistic accuracy, source permissions, semantic sentence matching, or all nested HTML safety. After content changes, inspect representative readings, sentences, and grammar markup in the UI.

## Packaging check

Use a new temporary output directory, then serve the staged package:

```sh
python3 scripts/sync_www.py --out /tmp/pengo-runtime-check
python3 -m http.server 8001 --directory /tmp/pengo-runtime-check
```

`sync_www.py` merges into existing output, so use a fresh directory for a clean-inventory check. Verify the staged app includes intro/course scripts, every data file, branding, SVGs, and `resources/CREDITS.md`. Stop the server with Ctrl+C. Native picker/Back behavior requires an installed APK.

## Manual acceptance matrix

Use a disposable browser profile or exported test backup. Record platform/browser/device, date, scenario, and actual result. Do not erase the user's active study profile to perform tests.

| ID | Procedure | Expected current behavior |
| --- | --- | --- |
| T-01 | Serve repo/package; open Home, Learn, all three types/levels | Required data loads; Settings loader reports fetch; counts agree with JSON |
| T-02 | Open a copied runtime via file URL; separately remove/block optional and required JSON in that copy | Required failure tries bundle; optional failures can leave empty sections; SVG access is browser-dependent |
| T-03 | Start without a plan; choose N4; save with no date and custom pace | Home changes from picker to dashboard; batch one and chosen settings persist |
| T-04 | Browse all three types; search English/kana/Japanese; filter/sort; navigate back | Results agree with fields; input retains focus; query/filter state works |
| T-05 | Open a kanji with art; play/replay, toggle numbers, autoplay, reduced motion | Correct SVG; controls work; reduced motion shows final strokes; unavailable art explains failure |
| T-06 | Open vocab and grammar; follow related/kanji links, reveal translation, inspect ruby | Existing records resolve; missing examples/links have empty states; markup is legible |
| T-07 | Toggle learned/favorite; enter a note; wait beyond debounce; reload | State persists; removing learned does not delete SRS; overlapping kanji shares state |
| T-08 | Run ordinary quizzes for each kind/level; answer correct/wrong; retry | Feedback and best score work; answers update SRS/course days; saved sessions resume without regrading; goals count unique effort |
| T-09 | Finish batch, continue, unlock early, leave backlog; change pace/target; end plan | Explicit unlocks; earlier material retained; change/reset semantics match course design |
| T-10 | Run mixed plan quiz, pause/reload midway, finish a perfect quiz | Answers grade SRS immediately; wrong due +10 minutes; completion counter/perfect flag only on finish |
| T-11 | Keep app visible then hide it; learn an item; inspect week/month and hero level | Rolling 7/30-day activity; visible-time updates; first-learned dedupe; counts reflect stored state |
| T-12 | Export; modify disposable progress; import original; try malformed/unrelated JSON | Valid import replaces store; unrelated file rejected; invalid JSON rejected; no merge |
| T-13 | Change theme/autoplay; replay intro; cancel erase; confirm erase in disposable profile | Controls persist; erase cancellation preserves state; confirmed erase resets store/intro flag |
| T-14 | Check desktop/phone/tablet/landscape, keyboard, zoom, both themes, reduced motion | Navigation/layout remain usable; focus visible; no clipped critical controls |
| T-15 | Install rebuilt APK; airplane-mode cold start; intro, rotate, Back, export/import/cancel | Local content/art work; picker callbacks work; Back traverses intro/routes and exits from Home |
| T-16 | Explicit reminder opt-in/denial, test, chosen-time delivery, goal completion, turn-off, erase, notification tap; native reboot/timezone/closed app | No startup permission request; denial leaves new reminders off; at most one daily alert when goal unmet; late alerts skipped; tap starts/resumes short practice; device settings remain outside progress imports; web/calendar limits visible |

For backup robustness changes, additionally test partial old backups, null/array maps, invalid nested SRS/course fields, large files, storage rejection, and missing IDs. Current import does not comprehensively reject every nested malformed shape.

## Checks by change type

| Change | Useful checks |
| --- | --- |
| Documentation | Relative links/anchors, source claims, diagram syntax, executable command snippets |
| CSS/view | JS syntax if affected; relevant manual matrix rows; themes/mobile/focus |
| Course logic | Existing assertions; targeted new invariant checks; T-03/T-09/T-10 |
| Storage/SRS | Old backup roundtrip, persistence failure behavior, T-07/T-10/T-12/T-13 |
| Content | Data/bundle check, ID diff, linguistic samples, T-01/T-05/T-06 |
| Packaging/native | Clean staging, debug build, airplane-mode/picker/Back checks |

Do not equate syntax checks with UI testing or pure Course assertions with SRS integration coverage. Report what actually ran. The [verification record](verification.md) documents this documentation task's checks.

## Practice browser integration

`npm test` runs the existing 97 course assertions through Node, 37 practice checks, 17 reminder-rule checks, and 7 notification-worker checks without installing npm dependencies. The course runner uses Python 3 to extract the original drivers. Practice checks cover bounded/mixed/due/mistake selection, same-day SRS promotion, session validation, legacy activity, goals, week/streak behavior, badges, and backup defaults. Reminder checks cover opt-in/time validation, delivery window, goals/duplicates, and calendar structure. Worker checks execute the real click handler with fake clients to verify scope-safe navigation/focus and opening a new window.

For browser checks, start the static server and install Playwright in a separate temporary environment:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# In another terminal:
npm install --prefix /tmp/pengo-qa playwright --no-audit --no-fund
NODE_PATH=/tmp/pengo-qa/node_modules PENGO_CHROME_CHANNEL=chrome node tests/test_practice_browser.cjs
```

`PENGO_CHROME_CHANNEL=chrome` uses installed Chrome. Otherwise install Playwright's Chromium in that temporary environment and omit the channel. `PENGO_TEST_URL` overrides the server URL; optional `PENGO_TEST_ARTIFACTS` names an existing directory for desktop/mobile screenshots. Isolated browser contexts do not open a user's existing profile.

The suite exercises real answers and reloads, pause/resume, no double grading, daily goals, achievements, mistake clearing, due filtering across levels, plan unlocking/completion/perfect flags, legacy Review entry points, ten-question best scores, grammar contextual questions, 320px layout, new/old backup imports, invalid sessions, legacy daily-item deduplication, blocked storage, and JSON-fetch fallback to `bundle.js`. This is browser evidence; it does not prove Android WebView/native bridge behavior or learning outcomes.

## Design and reminder browser integration

Using the same server and temporary Playwright environment:

```sh
NODE_PATH=/tmp/pengo-qa/node_modules PENGO_CHROME_CHANNEL=chrome node tests/test_design_reminders_browser.cjs
```

This suite contains 39 checks: mascot loading, removed Home tips, quick practice, response feedback/results, reduced motion, finite celebrations, reminder-section navigation, no unsolicited permission request, explicit permission denial, real service-worker notification display/retrieval in an isolated Chrome context, calendar download, goal/duplicate guards, time-change duplicate protection, backup/device-setting separation, erasure, unsupported-browser fallback, and main-route overflow at 320/390/768/1024/1440px. `PENGO_TEST_ARTIFACTS` also writes Home desktop, Review mobile, and dark Home screenshots.

Browser notifications are tested inside a temporary browser context, never by changing the user's own browser profile. API display evidence does not prove an OS banner appeared or a suspended/closed browser delivered a scheduled reminder. Calendar import/alerts depend on the chosen external calendar.

## Native reminder tests

With JDK 17, SDK 34, and Gradle available, stage current assets then run:

```sh
python3 scripts/build_apk.py --assets-only
npm run test:android
# Optional build in the same Gradle invocation:
gradle -p android :app:testDebugUnitTest :app:assembleDebug --console=plain
```

JUnit 4.13.2 and Robolectric 4.16.1 are test-only Gradle dependencies. The 26 tests cover local-time recurrence/year rollover/DST, off by default, single alarm replacement, permission/app/channel denial, explicit tests, duplicate/goal/late suppression, actionable tap, broadcast filtering, restore after boot/clock/timezone/package updates, receiver delivery without a WebView, full activity startup and opt-in callbacks, cold notification entry, cancellation during a permission request, and confirmed-reset behavior. Reports are generated under `android/app/build/test-results/testDebugUnitTest/`.

Robolectric uses a simulated SDK 33 Android framework for platform tests, plus plain Java calendar checks. It does not execute an actual Android WebView or emulate OEM alarm/doze policies. Use T-15/T-16 on supported physical devices for that acceptance evidence. The pinned test version supports these lifecycle tests; upgrading it requires rerunning the full visible-activity tests rather than weakening lifecycle coverage to accommodate a runner regression.

## Discovery cards and hierarchical components

```sh
python3 tests/test_components.py
node tests/test_discovery_browser.cjs
```

Browser tests need separately installed Playwright and a local HTTP server; use `NODE_PATH` to point to its installation. Discovery tests use isolated Chrome contexts, cover reveal/rating separation, duplicate grading, reloads, gestures, keyboard navigation, challenge completion, nested story/structural views, retired listening-session migration, file:// loading and staging cleanup. Screenshots at 320/390/768/1280px in light/dark themes default to `/tmp/pengo-discovery-qa`. The structural unit tests cover nested groups, anonymous strokes, disconnected/repeated parts, original/partial annotations and older SVG namespace declarations. Existing practice and reminder browser suites remain applicable. These checks establish behavior and layout, not improved learning outcomes.

## Restored study plan/settings browser checks

Run `tests/test_study_plan_browser.cjs` with the same Playwright/Chrome environment above. It covers Home/intro entry, preset/custom pace validation, persistence, stale route parameters, browse/search/detail/related-level focus, due/mistake/smart/explore/plan pools, overlapping kanji details, changing/ending plans without losing progress, theme-specific progress background/icon alignment, erase cancellation, autoplay, and 320/390/768/1440px layouts in both themes. `PENGO_TEST_ARTIFACTS` optionally writes screenshots. It uses isolated contexts and never erases the user’s active profile.

The ordinary practice browser suite leaves the N4 plan before its standalone N5 quiz/best-score assertions; this respects the restored target-level contract.

Validation on 2026-10-09: 71 study-plan/settings, 46 practice, and 40 design/reminder browser checks passed in isolated headless Google Chrome contexts. Core `npm test` passed (97 Course, 37 Practice, 17 Reminders, 7 worker checks, plus Dashboard checks). JS syntax and `git diff --check` passed. Mobile screenshots in both themes were visually inspected. Docker Android debug build passed; ZIP inspection confirmed that the APK contains the final `app.js`, `design.js`, `practice-ui.js`, and `styles.css`. Physical-device WebView behavior was not tested in this change.

## Flashcard entry and saved-format regression

Run `node tests/test_flashcards_browser.cjs` with Playwright and a local server. The isolated Chrome suite reproduces a saved answered quiz before opening flashcards; checks both sessions’ answers, reloads/imports, switching from daily challenges, finishing/resuming, plan-level isolation and 320/390/1280px layouts. It writes screenshots to `/tmp/pengo-flashcards-qa`.

## Learn, learning cards and quiz separation

Run `NODE_PATH=/path/to/playwright/node_modules PENGO_CHROME_CHANNEL=chrome node tests/test_learn_browser.cjs` with the local server. The isolated Chrome suite checks full quiz integration/removal of Review navigation, old-route filters, Home copy, three subject detail/related/reload/native-back returns, rated/unrated persistence, unchanged test attempts/accuracy/mistakes/SRS, first-study/challenge/daily-goal tracking, independent saved quiz/deck swaps, stale context, and actual count/title containment at 320/390/768/1024/1440px in both themes. Screenshots default to `/tmp/pengo-learn-qa`. Physical-device behavior remains a separate acceptance check.

Verified on 2026-10-09 for Learn/quiz separation: 71 Learn, 33 flashcard-access, 49 discovery, 46 practice, 40 design/reminder and 71 study-plan/settings browser checks passed (310 total). The full npm suite, runtime syntax checks and `git diff --check` passed. Element bounds and light/dark screenshots were checked from 320px to 1440px. The user's actual open tab returned from full details to its saved revealed card and displayed the merged Learn page, preserving the saved quiz. Docker APK assembly succeeded; 16 runtime/data/credits files match source, `www`, staged Android assets and APK bytes. No speech runtime was packaged. APK: 19,667,537 bytes (18.76 MiB), SHA-256 `eb8f6b4e77fda7db2ca989cd709f3294527dce35b3074fc591e56e727d7d96e9`. No physical-device test was performed.

## Daily learning and compact cards — 2026-10-09

Run `NODE_PATH=/path/to/playwright/node_modules node tests/test_daily_learning_browser.cjs` against the local server. It checks the merged two-page intro, status-only challenges, removed trail/extra headings, direct daily learning, exact remaining goal/plan sizes, saved-quiz protection, immediate Got it advance/completion, optional extra decks, date-scoped item lists and filters, kanji-detail cleanup, explicit meanings/Japanese readings, and real furigana for all subjects. The layout checks verify the Got it button stays above mobile navigation at 320×568, 360×640 and 390×844, plus tablet/desktop containment, in both themes. Screenshots default to `/tmp/pengo-daily-learning-qa`. Physical Android-device verification is separate.

## Home focus and challenge decks — 2026-10-09

Run `NODE_PATH=/path/to/playwright/node_modules node tests/test_home_refinement_browser.cjs` against the local static server. Checks cover the hero’s learning action (including goal completion and an active quiz), the connected daily subject list, removed Home cards, Progress milestones, tip toggle/close/Escape, reminder dismissal without permission and its device-local persistence, enabled-reminder hiding, exact remaining challenge sizes, exclusion of already counted items, challenge reload/backup/paused-slot resume, preservation/restoration of normal learning and quiz sessions, expired challenge recovery, ten-item challenge continuation, and the uniform compact recap for all subjects. Screenshots and actual list bounds are checked at 320/390/768/1280px in both themes; output defaults to `/tmp/pengo-home-refinement-qa`.


## Learn simplification and quiz history — 2026-10-09

Run `NODE_PATH=/path/to/playwright/node_modules node tests/test_quiz_redesign_browser.cjs` against the local static server. It covers removal of introductory/daily-practice/setup sections, the four direct subject choices and five-question default, selected-level and unlocked-plan pools, saved quiz reload/resume and optional replacement without regrading, completed history metadata and backup persistence, due/mistake shortcuts, old summaries without subject metadata, percentage normalization for different quiz lengths, last-ten ordering and recall exclusion, and containment at 320/390/768/1024/1440px in both themes. History is protected even after many learning decks. Screenshots default to `/tmp/pengo-quiz-redesign-qa`. Physical Android validation remains separate.

## All-level exploration and rotating cards

With the local server and isolated Playwright environment, run:

```sh
NODE_PATH=/tmp/pengo-qa/node_modules PENGO_CHROME_CHANNEL=chrome node tests/test_exploration_browser.cjs
```

This verifies all-level global results and read-only details while Learn/practice remain scoped, contextual Back through search/related details/reload, 120-result kanji deduplication, actual intermediate card rotation and keyboard tap-back, reduced motion, finite daily-word motion, no reveal-based learning, compact topbar placeholders, complete assets and both themes at 320/390/768/1280px. It saves review screenshots to `/tmp/pengo-exploration-qa` by default. Native WebView behavior still requires device acceptance.

## Dictionary, details and score feedback

With the same temporary Playwright setup and static server, run `NODE_PATH=/tmp/pengo-qa/node_modules PENGO_CHROME_CHANNEL=chrome node tests/test_dictionary_details_browser.cjs`. It checks dictionary-only matching (including kana folding, alternate meanings, example/metadata exclusions), topbar navigation and focus, structural/story separation and expandable parts, removed header badges, static Home mascot, actual quiz completion at 0/2/3/4/5 out of five, and mobile/desktop layouts in both themes. Screenshot artifacts default to `/tmp/pengo-dictionary-details-qa`. Existing exploration, discovery, Home refinement, quiz redesign and design/reminder suites also cover affected flows.

## Interactive tutorial

Run `NODE_PATH=/tmp/pengo-qa/node_modules PENGO_TEST_URL=http://127.0.0.1:8000/ node tests/test_tutorial_browser.cjs` with the same Playwright/Chrome setup. It taps actual highlighted controls through the full tour, verifies target/panel placement in portrait, landscape, tablet and desktop layouts, covers both themes/reduced motion, and compares study state across replay with saved quiz/card sessions. It also checks simulated Android first-launch/Back, intro completion, keyboard trapping/Escape, completed-challenge fallback, reload isolation, normal learning after exit, and offline `file://` bundle replay. Screenshots go to `/tmp/pengo-tutorial-qa`. Native-device touch/WebView acceptance still requires an installed APK.

## Search precision, detail alignment and stroke recovery — 2026-10-14

Stage with `python3 scripts/sync_www.py`, then run `NODE_PATH=/tmp/pengo-qa/node_modules node tests/test_search_strokes_browser.cjs` against the local server. The suite checks real `car` results (12, excluding 強力), whole English words/phrases and literal punctuation, alternate meanings, kana folding, scoped vocabulary browsing, actual text centering at 700/768/1024/1440px in both themes, Settings attribution, and byte equality between all 2,383 fallback diagrams and their original SVGs.

It deliberately blocks both SVG fetch and XHR to reproduce the reported error, verifies recovery/replay/number controls, failed-load retry, non-SVG responses, and direct `file://` loading of source and staged apps. Screenshots default to `/tmp/pengo-search-strokes-qa`. These are isolated Chrome browser checks; physical Android/iOS WebView acceptance remains separate.

Verified on 2026-10-14: 72 search/stroke, 82 dictionary/detail, 117 exploration and 49 discovery browser checks passed (320 total), plus `npm test`, five component unit tests, runtime/test syntax and diff checks. Desktop vocab, mobile fallback and Settings credit screenshots were inspected. Web, Android and iOS staging succeeded; 87 changed runtime/credit/fallback files match source across all three staged packages. Native binaries and physical-device behavior were not tested in this change.


## Home mascot alignment and APK — 2026-10-14

The Home hero artwork now centers vertically beside its text instead of sitting at the bottom of the column. The saved-deck Continue learning state was checked at 320/390/480/700/768/1024/1440px in both themes: all 14 layouts keep the mascot within the card and within 1px of the text’s vertical center. Desktop/light and phone/dark screenshots were inspected. The existing Home suite passed 60 checks; `npm test` and diff checks passed.

Docker debug APK assembly succeeded. All 2,514 staged web files match the APK bytes, including all 83 stroke fallback chunks and the final search/detail/credit/mascot changes. Android and iOS assets were refreshed. APK: `dist/pengo-debug.apk`, 23,690,946 bytes (22.59 MiB); SHA-256 `0720d837abd95816a8521c669c8a0e862baf497d852cff7de1fe90a5c6b23c67`. Physical Android-device interaction was not tested.
