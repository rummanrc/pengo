# Pengo

Pengo is a Japanese study app for JLPT N5–N1: kanji, vocabulary, grammar, quizzes, progress, and daily study plans. The web runtime is static HTML, CSS, JavaScript, and prebuilt data. Android and iOS wrap those same files in an offline WebView. The iOS shell builds with full Xcode; simulator launch and device acceptance remain to be checked. See [iOS setup](docs/ios.md).

## Run the web app

From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. No npm install, backend, or frontend compilation is required. Optional Capacitor development dependencies have a lockfile for source scanning; Android does not use them. Stop with Ctrl+C.

Opening `index.html` directly loads study data through `data/bundle.js` and stroke diagrams through lazy `data/strokes/*.js` fallback scripts. HTTP is the supported development path. The web manifest is present; the optional notification worker does not cache files, so hosted offline reload is not guaranteed.

## Documentation

Start with the [documentation index](docs/README.md). The engineering docs use Markdown and editable Mermaid diagrams, with prose explanations for viewers without Mermaid support.

| Need | Document |
| --- | --- |
| Understand the product and requirements | [Product](docs/product.md) |
| Explore the visual refresh and return reminders | [Design and reminders](docs/design-and-reminders.md) |
| Understand discovery cards and layered components | [Discovery cards and components](docs/discovery-cards.md) |
| Understand components and startup | [Architecture](docs/architecture.md) |
| Set up and change the project | [Development](docs/development.md), [contributing](CONTRIBUTING.md) |
| Find routes, views, and CSS conventions | [Frontend](docs/frontend.md) |
| Understand records, storage, and backups | [Data model](docs/data-model.md) |
| Rebuild or refresh content | [Data pipeline](docs/data-pipeline.md) |
| Understand scheduling and SRS | [Study plan](docs/course.md) |
| Use JavaScript and native interfaces | [Interfaces](docs/interfaces.md) |
| Validate changes | [Testing](docs/testing.md) |
| Package the web app or APK | [Deployment](docs/deployment.md) |
| Prepare an F-Droid release and updates | [F-Droid release](docs/fdroid.md) |
| Review trust boundaries and privacy | [Security](docs/security.md) |
| Diagnose failures and known gaps | [Maintenance](docs/maintenance.md) |
| Understand architecture tradeoffs | [Decisions](docs/decisions.md) |
| Give an AI assistant project context | [AI guide](docs/ai-guide.md) |
| See checks performed for these docs | [Verification](docs/verification.md) |
| Prepare a Japanese-company delivery | [Company delivery](docs/company-delivery.md), [delivery records](docs/delivery/project-plan.md) |

## Current features

- Search vocabulary across every JLPT level by Japanese word, reading or whole English words/phrases; Learn browsers search the chosen level. Explore related items outside the plan in read-only detail pages; use Back buttons to return.
- Kanji readings, components, memory aids, examples, notes, similar characters, and animated KanjiVG stroke diagrams.
- Animated tap-to-flip discovery cards with meanings, readings, memory stories and nested components. Choose “Got it” or “Still learning”, then swipe or tap to advance. Return from full details to the same card.
- Text-only learning: pronunciation clips, voice controls and native TTS have been removed to reduce app size.
- Vocabulary and grammar examples with available furigana and links to related content.
- Learn combines three compact subject cards and learning cards with four one-tap quiz choices (up to five questions), due/mistake shortcuts and visual history of the latest ten quizzes. Existing explicit 3/5/10-question links remain supported. Quiz answers update SRS; learning confidence does not change quiz accuracy.
- Saved sessions, daily practice goals, weekly activity and learning milestones in Progress, supportive achievements, and score-dependent quiz feedback and mascots, and session summaries with a clear stopping point.
- An adventure dashboard with distinct kanji/vocabulary/grammar totals for today, targeted daily challenges, a connected list of today’s subject totals, a page of today’s studied items, a Pengo invitation that reveals today’s word and meaning, a hero learning button with a static greeting mascot, and dark/reduced-motion support.
- Opt-in daily Android reminders while closed; open-page browser alerts and a calendar download, with goal/duplicate suppression for Pengo alerts.
- Friendly study-plan setup with a JLPT destination, a suggested 5-item daily pace, custom batch sizes, and level-focused browsing/practice. Change the plan in Settings; batches wait until you are ready. Explicit batch unlocking, unfinished-material backlog, study days, and milestones remain available.
- Progress with learned counts and rolling seven-/thirty-day activity; themes, backups, confirmed erasure, and intro replay.
- An interactive first-launch tutorial with guided taps through cards, today’s word, daily items/challenges, quizzes and Progress; replay it from Settings. Tutorial previews preserve your real study state.
- Offline native Android assets, system document pickers for backups, and no `INTERNET` manifest permission.

There are no accounts, cloud sync, analytics, or backend. See [daily learning improvements](docs/learning-improvements.md) for the delivered feature list and next content track.

## Repository map

```text
index.html          Shell and script order
styles.css          Themes, components, responsive layout, motion
app.js              Loading, router, views, storage, quizzes, SRS
course.js           Pure study-plan logic; browser global/CommonJS export
practice.js         Pure practice selection, SRS, session validation, motivation
practice-ui.js      Shared practice player and daily dashboard
components.js       Layered KanjiVG and existing mnemonic-part views
recall-ui.js        Resumable flip-card player
dashboard.js        Daily subject counts, challenges, and discovery rules
design.js           Adventure Home, daily progress, mascot, quick choices
reminders.js        Opt-in device reminder settings and browser delivery
reminder-worker.js  Browser notification taps; no caching or scheduling
platform.js         Browser/native adapter
onboarding.js       Welcome and first-launch state
tutorial.js         Guided taps and isolated practice previews
assets/             Branding and mascot images
data/               Generated JSON and script-loading fallback bundle
resources/          Tracked source material, SVGs, and credits
scripts/            Python data and packaging tools
tests/test_course.py Existing course assertions
android/            Java WebView shell and Gradle configuration
ios/                Swift WKWebView shell and Xcode project
docker/Dockerfile   Android build environment
docs/               Engineering documentation
```

`www/`, staged Android assets, `dist/`, and Gradle outputs are generated and ignored. This checkout tracks `resources/` as ordinary files and has no `.gitmodules`; upstream resource documentation describes submodule use by other consumers.

## Content snapshot

Checked against the JSON on 2026-10-16:

| Level | Kanji rows | Vocabulary | Grammar |
| --- | ---: | ---: | ---: |
| N5 | 103 | 684 | 77 |
| N4 | 181 | 640 | 89 |
| N3 | 361 | 1,730 | 130 |
| N2 | 739 | 1,812 | 149 |
| N1 | 1,232 | 3,427 | 150 |
| Total | 2,616 | 8,293 | 595 |

The kanji lists overlap: 2,616 rows represent 2,211 distinct characters. Progress is shared by character. These are dated counts, not UI constants.

## Tests

The existing Python harness uses dukpy:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install dukpy
.venv/bin/python tests/test_course.py
```

Do not commit `.venv/`. Missing dukpy produces `SKIP` and a successful exit, which is not a test pass. Run `npm test` for the Node alternative: course, practice, reminder, notification-worker and dashboard rules, legacy-progress migration, and native JavaScript bridge checks, with no npm install required. Browser integration and native reminder tests are described in [testing](docs/testing.md).

## Android debug APK

With JDK 17, Android SDK platform 34/build tools, and Gradle available:

```sh
python3 scripts/build_apk.py
```

Output: `dist/pengo-debug.apk`. Stage assets only with:

```sh
python3 scripts/build_apk.py --assets-only
```

With Docker running:

```sh
python3 scripts/build_apk_docker.py
```

These build a debug APK with application ID `io.github.rummanrc.pengo.debug`.
For the unsigned release that F-Droid can build and sign, run
`python3 scripts/build_apk_docker.py --release` (or `npm run build:fdroid`
with a local Android toolchain). Output: `dist/pengo-release-unsigned.apk`.
This unsigned file is not directly installable. See [F-Droid preparation](docs/fdroid.md)
for licensing, public-source and submission requirements, and
[deployment](docs/deployment.md) for toolchain details and optional Capacitor limitations.

## iOS debug app

On a Mac with full Xcode, stage assets and open the project:

```sh
python3 scripts/build_ios.py --assets-only
open ios/Pengo.xcodeproj
```

Select your signing team and connected iPhone, then press Run. A free Apple Account supports personal-device debug installation with seven-day signing; simulator builds need no signing account. `npm run build:ios` builds a simulator app; `npm run test:ios` checks the native date/path logic and JavaScript bridge using macOS command-line tools. See [iOS debug builds](docs/ios.md) for signing, reminders, and the remaining device checks.

For SideStore or AltStore Classic, run `npm run build:ipa` to produce `dist/pengo-ios-unsigned.ipa`. The sideloader signs this device build using your Apple Account and can refresh its signing before expiry. See [personal sideloading setup](docs/ios.md#personal-installation-with-sidestore-or-altstore-classic) for requirements and refresh limitations.

## Content and attribution

Normal development uses existing `data/`. Vocabulary CSVs and the Tatoeba TSV needed for full vocabulary regeneration are absent from this checkout. Grammar rebuilds use the checked-in, pinned Japanese Language Data snapshot. Read [the pipeline guide](docs/data-pipeline.md) before rebuilding.

Keep [resource credits](resources/CREDITS.md) with distributed data. They identify source-specific terms and unresolved source permissions. Pengo’s original code is licensed under Apache-2.0; bundled data retains the separate licenses listed in the credits.
