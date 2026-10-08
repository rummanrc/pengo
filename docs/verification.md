# Current verification

The 2026-10-09 text-only discovery-card and hierarchical-component checks are recorded in [discovery cards](discovery-cards.md). Audio checks below are historical evidence for the removed implementation.

# Documentation verification record

## Natural audio and Home implementation checks — 2026-10-08

Current worktree evidence (separate from historical checks below): course 97, practice 37, reminder rules 17, and worker 7 checks pass, along with the new dashboard/listening rule suite. The dashboard/neural-media browser suite passes 41 checks; device pronunciation passes 35; shared practice passes 46; design/reminders passes 40. The Android Docker toolchain passes all 33 Robolectric/JUnit tests with no failures, errors, or skips. Home screenshots were inspected at mobile/desktop sizes and both themes; 320/390/768/1280px overflow checks pass. Model files match the pinned upstream revision and published SHA-256. Current syntax, local Markdown file links, and diff whitespace checks pass.

The full pack verifier passes: 8,293/8,293 vocabulary records, 7,033 distinct readings plus three sentence clips, all 7,036 files decoded with finite non-silent mono 24kHz samples. Audio occupies 69.0 MiB; durations range 0.50–5.16 seconds. No temporary audio files remain. Real-media browser checks pass 32 assertions over HTTP and staged `file://`, including normal/slow sentences, actual listening-answer gating, and playback without a speech synthesis service. Original content arrays and IDs have no data diff.

The debug APK builds successfully in the cached Android Docker toolchain. The runtime stages 9,463 files (109.7 MiB), and all 9,463 APK web assets match staging byte-for-byte. Exact source-to-staging inventory/bytes also pass. All 7,036 MP3s and the full manifest ship in the APK. The merged manifest declares only notification and boot permissions, with no internet permission. Artifact: `dist/pengo-debug.apk`, 89.0 MiB, SHA-256 `bd5e01fa2f03b1e0ca8e95d9287f3e25d3e401caa8d5bc87c5ee0bfa47fa6561`.

The [implementation checklist](motivation-and-audio-plan.md) is complete. These results verify the implementation, layouts, playback, persistence, and offline packaging. Physical Android speaker/headphone acoustics, interruptions, and proficient-speaker review of pitch/accent and assessment scripts remain release/editorial acceptance checks; automated playback does not establish exam suitability.

**Date:** 2026-10-07 (Asia/Tokyo). **Source baseline:** `e35e5fa`, plus the documentation changes in this workspace. This is a dated engineering-documentation check, not a product/customer acceptance or production-release approval.

## Executed checks

| Check | Result | Scope and limit |
| --- | --- | --- |
| Existing course drivers under Node | 97 assertions passed; no failures | Actual `course.js` plus DRIVER/DRIVER2 from the Python harness; dukpy not installed/tested |
| JavaScript syntax | Passed for app/course/platform/onboarding | Node `--check`; no DOM execution |
| Python syntax | Passed for root scripts and tests | AST parse with UTF-8/BOM handling; no data rebuild |
| Content metadata and IDs | Passed | All 15 level arrays, counts/level fields and uniqueness within each level |
| Stroke-file consistency | Passed | All declared codepoints/coverage match existing SVGs |
| Canonical radicals | Passed | Numbers 1–214 and bundle parity |
| Fallback bundle consistency | Passed | Every level array and all three metadata files equal JSON; radicals equal too |
| Clean static staging | Passed | 2,418 files, 41,303,820 bytes (~39.4 MiB); every staged file matched source SHA-256 |
| Static HTTP package checks | Passed | 30 requests for shell/scripts/style/manifest, all data files, icon, credits, and representative SVG; response bytes matched staged files |
| Course interface completeness | Passed | All 42 exports in `course.js` covered by the interface reference |
| Local documentation links/anchors | Passed | 141 local links/anchors across 24 Markdown documents |
| Markdown fences | Passed | Balanced code fences across the documentation set |
| Mermaid syntax | Passed | Six diagrams parsed with Mermaid 12.1.0 in an external temporary environment |
| Diff whitespace | Passed | `git diff --check`; changed tracked files are documentation |

The read-only command snippets in [testing](testing.md) were executed, including its Node alternative. Local tools used were Python 3.9.6 and Node v22.16.0. Staging used a newly created temporary directory outside the repository and did not alter generated workspace/native assets.

## Documentation checks

Relative links and heading anchors were checked across the root README, contributing guide, and documentation tree. Mermaid parsing used temporary Mermaid/jsdom dependencies outside the repo and checked syntax rather than exported visual rendering. The temporary static HTTP server was shut down after the checks. No validation packages or server configuration were added to Pengo.

## Findings recorded

- Raw vocabulary CSVs, Tatoeba TSV, and grammar Anki deck required for full regeneration are missing.
- Kanji level rows overlap: 2,616 rows represent 2,211 distinct characters; 2,383 SVG files are present.
- Current Review quizzes record scores without grading SRS, while plan quizzes grade shared SRS.
- Resources are ordinary tracked files in this checkout; no `.gitmodules` exists.
- Native wrapper launchers/JAR and production release-signing configuration are absent.
- Existing README/course documentation had stale feature and assertion-count descriptions; those were updated from source/evidence.

Further confirmed gaps are in [maintenance](maintenance.md). Official IPA, Digital Agency, and PPC materials were consulted for [company-delivery recommendations](company-delivery.md), which distinguish draft process records from actual approvals or applicable legal/contractual requirements.

## Not executed

No visual browser walkthrough, accessibility audit, native APK compilation/device test, dukpy-engine run, complete raw-data regeneration, production publication, stakeholder sign-off, or legal/source-permission determination was performed. No runtime source or CSS changes were made by this documentation work.

Use the [test matrix](testing.md) and [delivery records](delivery/review-and-acceptance.md) to collect that evidence for a real candidate. Do not turn a documentation check into a claim that all Pengo features are accepted.

## Daily practice implementation verification

**Date:** 2026-10-07 (Asia/Tokyo). This later record covers the daily-learning runtime changes in the workspace; the earlier documentation-only results above remain historical.

| Check | Result | Scope and limit |
| --- | --- | --- |
| Existing course regression drivers | 97 assertions passed | Actual Course source under Node; dukpy not exercised |
| Practice rules | 37 checks passed | Actual selection, SRS, saved-session validation, activity, goals, badges, and migration defaults |
| Chrome browser integration | 46 checks passed | Isolated contexts; real answers, pause/reload/resume, due/mistake queues, goal dedupe, plan counters/perfect flags, best scores, contextual grammar, backups, storage rejection, and bundle fallback |
| Mobile/desktop layouts | Passed | 320px overflow checks; inspected 390px recall, 320px dark Home, and 1280px practice screenshots in installed Chrome |
| Runtime and Python syntax | Passed | All six root JavaScript scripts; Python root scripts and tests |
| Static/native asset staging | Passed | 2,420 files (~39.4 MiB); every staged file matched source SHA-256; all shell script references exist |
| Documentation local targets | Passed | 149 non-web file targets exist across README, contributing guide, and docs |
| Diff whitespace | Passed | `git diff --check` |

The browser suite and Playwright dependency used a separate temporary directory, with no changes to the user's browser profile. Screenshots and staged artifacts were generated outside the repository. No APK build/device test, production deployment, full accessibility audit, or learner-outcome study was performed. Delivered capabilities and further content needs are listed in [daily learning improvements](learning-improvements.md).

## Adventure design and reminders verification

**Date:** 2026-10-07 (Asia/Tokyo). **Source baseline:** `b380887`, plus the implementation changes in this workspace. This subsequent record covers the visual refresh and notification implementation. Earlier records describe their own historical scope.

| Check | Result | Scope and limit |
| --- | --- | --- |
| Node regression/rule suites | 97 course assertions + 37 practice + 17 reminder + 7 worker checks passed | Actual source; no npm runtime dependencies or dukpy execution |
| Existing Chrome practice integration | 46 checks passed | Shared SRS, answers, resume, due/mistake filters, backups, storage failure, and fallback bundle |
| Chrome design/reminder integration | 40 checks passed | Original mascot, quick starts, learning trail, feedback/results, finite/reduced motion, explicit permission/denial, real worker notifications, goal/duplicate suppression, calendar download, device preferences/import/erase, unsupported-browser fallback |
| Responsive layout and visuals | Passed | Main routes at 320/390/768/1024/1440px; inspected desktop Home, mobile Review, dark Home, and actual phone viewports including reminder settings and page bottom |
| Native JUnit/Robolectric | 26 tests passed; no failures/skips | 5 local-time tests, 15 alarm/receiver/notification tests, 6 full-activity permission/reset/entry tests; simulated SDK 33 |
| Android compilation | Debug APK built successfully | Gradle 8.7/JDK 17/SDK 34 through cached `knowkanji-builder` Docker image on amd64; `testDebugUnitTest` and `assembleDebug` |
| Static/APK asset parity | Passed | 2,424 runtime files / 42,325,084 bytes; every fresh staged file equals source bytes and the APK asset entry; all eight classic scripts and notification worker present |
| Packaged Android permissions | Passed | `aapt dump permissions`: only notification and boot permissions; no internet or exact-alarm permission |
| JavaScript/Python syntax | Passed | Root JS, Node test files, Python scripts/tests |
| Documentation and whitespace | Passed | 172 local file links, heading anchors, and balanced fences across 26 documents; `git diff --check` |

The new asset [pengo-adventure.png](../assets/pengo-adventure.png) was produced with the built-in image generation tool from the existing mascot reference; the exact prompt is in [design and reminders](design-and-reminders.md#mascot-asset-and-generation-record). Browser checks used temporary Playwright dependencies and isolated contexts. No user browser permissions/profile were changed. The local test server was stopped after verification.

Review artifacts are ignored `dist/pengo-debug.apk` and `dist/pengo-home-preview.png`. APK SHA-256: `ac65f57a2b5392463736200fa61c53d4c4feb10c1049a5389ad475de2fb97151`. These are a debug candidate and a visual preview, not a production release. No physical-device/OEM power-management test, external calendar import, accessibility conformance audit, deployment, or retention/learning-outcome study was performed. Browser alerts require an open page; calendar alerts cannot suppress themselves based on Pengo goals.

## Vocabulary pronunciation verification

**Date:** 2026-10-07 (Asia/Tokyo). **Source baseline:** `add0121`, plus the vocabulary speech implementation in this workspace. The earlier records retain their historical scope.

| Check | Result | Scope and limit |
| --- | --- | --- |
| Node regression suites | 158 checks passed | 97 course, 37 practice, 17 reminder, 7 worker |
| Chrome pronunciation integration | 35 checks passed | Tap-only controls, dictionary kana, installed local Japanese voice selection, slow replay, replacement/stale callbacks, navigation/filter/question/background cancellation, missing/late voices, errors/watchdog, native bridge/settings, hidden-answer protection, recall reveal, 44px touch controls, narrow dark layout, unsupported browser |
| Existing Chrome integration | 46 practice + 40 design/reminder checks passed | Existing persistence, SRS, motion, reminders and responsive behavior |
| Native JUnit/Robolectric | 33 tests passed; no failures/errors | Seven new speech cases plus 26 existing tests; simulated SDK 33 |
| Android compilation | Debug APK built successfully | Cached Docker toolchain, JDK 17/Gradle 8.7/SDK 34 |
| Exact source/staged/APK inventory and bytes | Passed | Fresh bundle: 2,425 files, 42,333,083 bytes; every runtime file equals source and APK asset bytes, with no obsolete staged files |
| Android manifest | Passed | `TTS_SERVICE` query present; only notification/boot permissions, no added speech/microphone/internet permission |
| File-mode smoke test | Passed | Staged `www/index.html` loads fallback bundle and 684 N5 speaker buttons without JavaScript errors |
| Visual/syntax/documentation checks | Passed | Inspected 390px vocabulary list/detail screenshots; tested 320/390/768/1024/1440px list/detail/course layouts, checked changed JS syntax, local documentation targets, and diff whitespace |

The updated ignored artifact is `dist/pengo-debug.apk` (19,545,088 bytes), SHA-256 `3facc4670bcba9582a8d651ce226b6f21a849a7f87b118fcdeb5a4af08c24d68`. Browser checks use isolated contexts and speech doubles; actual headless Chrome exposed no installed voices. Native tests simulate TTS and lifecycle. Audible pronunciation quality, real-device Japanese voice installation, and airplane-mode listening remain manual acceptance checks. No deployment or changes to the user's browser profile were performed. See [pronunciation](pronunciation.md) for voice support and recovery.
