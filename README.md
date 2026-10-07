# Pengo

Pengo is a Japanese study app for JLPT N5–N1: kanji, vocabulary, grammar, quizzes, progress, and daily study plans. The web runtime is static HTML, CSS, JavaScript, and prebuilt data. Android wraps those same files in an offline WebView.

## Run the web app

From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. No npm install, backend, or frontend compilation is required. Stop with Ctrl+C.

Opening `index.html` directly can load study data through `data/bundle.js`, but browser file restrictions may block stroke diagrams. HTTP is the supported development path. The web manifest is present; no service worker provides guaranteed offline caching for hosted visits.

## Documentation

Start with the [documentation index](docs/README.md). The engineering docs use Markdown and editable Mermaid diagrams, with prose explanations for viewers without Mermaid support.

| Need | Document |
| --- | --- |
| Understand the product and requirements | [Product](docs/product.md) |
| Understand components and startup | [Architecture](docs/architecture.md) |
| Set up and change the project | [Development](docs/development.md), [contributing](CONTRIBUTING.md) |
| Find routes, views, and CSS conventions | [Frontend](docs/frontend.md) |
| Understand records, storage, and backups | [Data model](docs/data-model.md) |
| Rebuild or refresh content | [Data pipeline](docs/data-pipeline.md) |
| Understand scheduling and SRS | [Study plan](docs/course.md) |
| Use JavaScript and native interfaces | [Interfaces](docs/interfaces.md) |
| Validate changes | [Testing](docs/testing.md) |
| Package the web app or APK | [Deployment](docs/deployment.md) |
| Review trust boundaries and privacy | [Security](docs/security.md) |
| Diagnose failures and known gaps | [Maintenance](docs/maintenance.md) |
| Understand architecture tradeoffs | [Decisions](docs/decisions.md) |
| Give an AI assistant project context | [AI guide](docs/ai-guide.md) |
| See checks performed for these docs | [Verification](docs/verification.md) |
| Prepare a Japanese-company delivery | [Company delivery](docs/company-delivery.md), [delivery records](docs/delivery/project-plan.md) |

## Current features

- Browse and search all three content types by level, reading, and meaning; filter learned items and favorites.
- Kanji readings, components, memory aids, examples, notes, similar characters, and animated KanjiVG stroke diagrams.
- Vocabulary and grammar examples with available furigana and links to related content.
- Review quizzes of up to ten questions for a selected type/level; mixed study-plan quizzes update SRS state.
- Study plans with explicit batch unlocking, unfinished-material backlog, study days, and milestones.
- Progress with learned counts and rolling seven-/thirty-day activity; themes, backups, confirmed erasure, and intro replay.
- Offline native Android assets, system document pickers for backups, and no `INTERNET` manifest permission.

There are no accounts, cloud sync, analytics, or backend. Flashcards and a separate due-only review player are not exposed by the current router.

## Repository map

```text
index.html          Shell and script order
styles.css          Themes, components, responsive layout, motion
app.js              Loading, router, views, storage, quizzes, SRS
course.js           Pure study-plan logic; browser global/CommonJS export
platform.js         Browser/native adapter
onboarding.js       Intro and first-launch state
assets/             Branding and mascot images
data/               Generated JSON and script-loading fallback bundle
resources/          Tracked source material, SVGs, and credits
scripts/            Python data and packaging tools
tests/test_course.py Existing course assertions
android/            Java WebView shell and Gradle configuration
docker/Dockerfile   Android build environment
docs/               Engineering documentation
```

`www/`, staged Android assets, `dist/`, and Gradle outputs are generated and ignored. This checkout tracks `resources/` as ordinary files and has no `.gitmodules`; upstream resource documentation describes submodule use by other consumers.

## Content snapshot

Checked against the JSON on 2026-10-07:

| Level | Kanji rows | Vocabulary | Grammar |
| --- | ---: | ---: | ---: |
| N5 | 103 | 684 | 79 |
| N4 | 181 | 640 | 95 |
| N3 | 361 | 1,730 | 100 |
| N2 | 739 | 1,812 | 61 |
| N1 | 1,232 | 3,427 | 64 |
| Total | 2,616 | 8,293 | 399 |

The kanji lists overlap: 2,616 rows represent 2,211 distinct characters. Progress is shared by character. These are dated counts, not UI constants.

## Tests

The existing Python harness uses dukpy:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install dukpy
.venv/bin/python tests/test_course.py
```

Do not commit `.venv/`. Missing dukpy produces `SKIP` and a successful exit, which is not a test pass. A verified Node alternative is in [testing](docs/testing.md). The current drivers execute 97 assertions.

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

These build a debug APK. Release signing and store distribution are not configured. See [deployment](docs/deployment.md) for toolchain details and optional Capacitor limitations.

## Content and attribution

Normal development uses existing `data/`. Vocabulary CSVs, the Tatoeba TSV, and the grammar Anki package needed for full regeneration are absent from this checkout. Read [the pipeline guide](docs/data-pipeline.md) before rebuilding.

Keep [resource credits](resources/CREDITS.md) with distributed data. They identify source-specific terms and unresolved source permissions. No root application `LICENSE` exists; these docs do not assign one.
