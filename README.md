# KnowKanji - JLPT Kanji Study App

A responsive, data-driven Japanese kanji learning web app for JLPT N5-N1.
No build step, no dependencies: just static files plus prebuilt JSON.

## Run it

Any static server from the repo root, e.g.:

    python -m http.server 8000

then open http://localhost:8000/

(Double-clicking index.html also works: if data fetch is blocked, the app
falls back to data/bundle.js, which script tags can load anywhere.)

(Browsers block `fetch()` on `file://` URLs, so a local server is required.
GitHub Pages works too, but `resources/` is a submodule: enable
`submodules: true` in your Pages workflow so stroke art and data resolve.)

## Project layout

    index.html            app shell (sidebar + topbar + bottom nav + view)
    styles.css            theme, layout, responsive rules (mobile bottom nav)
    app.js                hash-router SPA: home/browse/detail/study/review/search/progress/settings
    data/n5..n1.json      per-level kanji records (generated, UTF-8)
    data/vocab_n5..n1.json per-level vocabulary records with Tatoeba sentences (generated, UTF-8)
    data/radicals.json    the 214 Kangxi radicals, correctly numbered
    data/meta.json        counts + stroke-art coverage per level
    scripts/build_data.py rebuilds data/ from resources/ (the kanji-data submodule)
    resources/            upstream data (KANJIDIC2, KRADFILE, KanjiVG, Tanaka, Kanjium...)

## Data model (one entry in data/nX.json)

    k            kanji character            cp      5-hex codepoint (stroke art file)
    meaning      primary English meaning    meanings  up to 5 variants
    on / kun     reading arrays             strokes / grade / freq / jlpt
    components[] { c, m, rad, isKanji, link, variantOf }
      c = component as written, m = its meaning,
      rad = Kangxi number or null (true radicals vs mnemonic parts are labelled),
      link = dataset kanji to jump to, variantOf = standard form if written as a variant
    vocab[]      { w, r, m } up to 6 JLPT compounds using the kanji
    sentences[]  { jp, ro, en } CSV sentence + Tanaka-corpus sentences
    confusables[] look-alike kanji        hasStroke  KanjiVG diagram available?
    mnemonic     prebuilt original memory aid (memory aid, not etymology)

To update data, replace files under resources/ and run `python scripts/build_data.py` (kanji) and `python scripts/build_vocab.py` (vocab + Tatoeba sentences).
Then `python scripts/build_bundle.py` to refresh the file:// fallback bundle.

## Features

- Home with per-level stats computed from data (never hardcoded)
- Browser: level chips, kanji/meaning/reading search, learned/unlearned/favorites
  filters, sort (default, strokes, frequency, A-Z, unlearned-first)
- Detail: readings, stats, animated KanjiVG stroke order with replay,
  component breakdown with Kangxi-vs-helper badges, original mnemonic,
  vocabulary, sentences, similar kanji, notes, prev/next navigation
- Study flashcards (3 modes, keyboard support), SRS review queue, 10-question quiz
- Progress dashboard, export/import backup, dark mode, responsive + keyboard accessible
- All user data persists in localStorage; mnemonic engine exposes
  `KanjiMnemonic.generateViaModel` for future LLM-generated stories.

## Offline Android app

The web app above is already server-free (static files + `localStorage`), so the
Android build is a thin offline shell around it: a native `WebView` loads the
bundled files, no Python/backend/server/internet at any point.

    Web:      index.html + app.js + platform.js + styles.css
              + data/*.json (+ data/bundle.js fallback) + resources/stroke-order/*.svg
    Android:  android/ (native WebView shell, no INTERNET permission)
    Bundle:   www/ (generated) -> android/app/src/main/assets/www/ (generated)

### Prerequisites (build machine only)

- JDK 17+
- Android SDK with platform-34 + build-tools (`ANDROID_HOME` or `ANDROID_SDK_ROOT` set)
- Gradle on PATH, or `android/gradle/wrapper/gradle-wrapper.jar`
- Python 3 (no Node needed for the native build)

### Build the APK

    python scripts/build_apk.py

Result:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- copied to `dist/knowkanji-debug.apk`

Install: copy the APK to your phone/tablet, open it, allow
"Install unknown apps" for your file manager, and install. Airplane mode works.

### Handy commands

    python scripts/sync_www.py                 # rebuild www/ only (offline check)
    python scripts/build_apk.py --assets-only  # stage assets without Gradle
    python -m http.server 8000                 # web smoke test -> http://localhost:8000/

### Optional Capacitor flow

`capacitor.config.json` + `package.json` are included for teams that prefer
Capacitor: `npm install`, `python scripts/sync_www.py`, `npx cap add android`
(first time), `npx cap sync android`. The checked-in `android/` project is the
zero-Node alternative and is what `scripts/build_apk.py` uses.

### Notes

- Persistence stays in `localStorage` (WebView) under key `knowkanji:v1`;
  export/import lives in Settings and Progress (`platform.js` picks Web Share
  on Android when available).
- Android Back navigates in-app history via `window.KKBack` and exits from Home.
- No analytics, no network permission, no secrets in the app.
### Docker build (no local toolchain)

If you have Docker Desktop but no JDK/SDK/Gradle installed:

    python scripts/build_apk_docker.py

This builds the `knowkanji-builder` image (`docker/Dockerfile`: Gradle 8.7 +
JDK 17 + Android SDK platform-34), compiles the APK inside it, and extracts
the result to `dist/knowkanji-debug.apk`. Needs ~8 GB free for the image and
network access during the image build only. Start Docker Desktop first; on
Windows it must use Linux containers.