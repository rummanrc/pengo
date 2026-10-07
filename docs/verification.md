# Documentation verification record

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
