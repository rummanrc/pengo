# Testing and acceptance

## Coverage today

`tests/test_course.py` evaluates the actual `course.js` plus two JavaScript drivers in dukpy. This snapshot executes **97 assertions**, covering dates/exam generation, pace, daily splits, curriculum coverage, unlocking, streaks, sampling, progress, milestones, defaults, ordering, schedule states, and greetings.

Daily practice adds 37 pure-logic checks and an optional browser persistence/SRS integration suite. Design/reminder checks add 17 reminder rules, 7 worker checks, 40 browser checks, and 26 native JUnit/Robolectric tests. Content-pipeline tests, physical-device Android instrumentation, CI, a formatter, and a linter are still absent. Manual procedures below fill those gaps; they are not claims that every procedure has been run.

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

This suite contains 40 checks: mascot loading, real learning trail, quick practice, response feedback/results, reduced motion, finite celebrations, reminder-section navigation, no unsolicited permission request, explicit permission denial, real service-worker notification display/retrieval in an isolated Chrome context, calendar download, goal/duplicate guards, time-change duplicate protection, backup/device-setting separation, erasure, unsupported-browser fallback, and main-route overflow at 320/390/768/1024/1440px. `PENGO_TEST_ARTIFACTS` also writes Home desktop, Review mobile, and dark Home screenshots.

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
