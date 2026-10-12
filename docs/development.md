# Development guide

## Minimal web setup

Use a browser with modern JavaScript and Python 3 for a local static server. Node/npm is unnecessary for ordinary web development.

```sh
cd /path/to/pengo
python3 -m http.server 8000
```

Open <http://localhost:8000/>. Edit root source files and reload. There is no compiler, hot-reload server, or asset fingerprinting. If old styling persists, disable the browser cache or hard-reload. This checkout has `python3`; a `python` alias is not required.

For intro preview, open <http://localhost:8000/?onboarding=1>. This query deliberately replays the intro even if it has been completed. Hash parameters such as `#/learn?lv=N4` belong after `#`, independently of the intro preview query.

Serve only for local development. For public hosting, stage the runtime inventory as described in [deployment](deployment.md).

## Dependencies by task

| Task | Dependencies | Installation/entry point |
| --- | --- | --- |
| Run web | Browser; Python 3 or another static server | Prebuilt data already present |
| Course test harness | Python 3 and dukpy | Isolated environment below |
| Alternative course assertions | Node plus Python 3 | [Testing](testing.md#node-alternative) |
| Core content scripts | Python standard library | Missing inputs may prevent some rebuilds |
| Sudachi furigana | SudachiPy and SudachiDict Core | Optional; see [pipeline](data-pipeline.md) |
| Native APK | Python 3, JDK 17, SDK 34/build tools, Gradle | [Deployment](deployment.md) |
| Native iOS debug app | macOS, Python 3, full Xcode/iOS SDK; Apple Account for device signing | [iOS debug builds](ios.md) |
| iOS logic/bridge checks | macOS command-line tools/Swift, Python 3, Node | `npm run test:ios`; does not compile UIKit/WebKit |
| Docker APK | Python 3, Docker daemon/CLI | `scripts/build_apk_docker.py` |
| Capacitor experiments | Node/npm and optional package dev dependencies | Separate integration work required |

`package.json` declares only optional Capacitor dev dependencies, with `^6.0.0` ranges. There is no lockfile or frontend build script. `npm test` runs dependency-free Node course/practice/reminder/worker checks (Python 3 is needed to extract the existing course drivers). `npm install` is not part of the native Java shell build. Native reminder tests use test-only JUnit/Robolectric Gradle dependencies; see [testing](testing.md#native-reminder-tests).

## Test environment

To keep dependencies outside the repository:

```sh
python3 -m venv /tmp/pengo-docs-venv
/tmp/pengo-docs-venv/bin/python -m pip install dukpy
/tmp/pengo-docs-venv/bin/python tests/test_course.py
```

Choose another environment path if needed. The current test drivers contain 97 assertions. Missing dukpy produces `SKIP` with exit zero, so inspect the output. The [Node alternative](testing.md#node-alternative) runs the same drivers without installing dukpy.

## Finding implementation

```sh
rg -n 'function render|function course|STORE_KEY' app.js
rg -n 'function |return \{' course.js
rg -n '@media|data-theme|:focus|prefers-reduced-motion' styles.css
rg --files scripts tests docs android
```

Use [frontend](frontend.md) for view/route ownership and [interfaces](interfaces.md) for public helpers. `app.js` is one large script divided by comment sections; its helpers are not independent modules. Preserve script ordering if moving declarations.

## Common change workflows

### Views and styling

Change the relevant renderer in `app.js`, `practice-ui.js`, or `design.js` and matching selectors/tokens in `styles.css`. Check hash navigation, retained search focus, both themes, mobile/desktop layout, and reduced motion. If adding a runtime script or asset path, update `index.html` where applicable and the `FILES`/`DIRS`/`EXTRA` inventory in `sync_www.py`.

### Course behavior

Place pure scheduling/order/sampling changes in `course.js`, then adjust integration in `app.js` as needed. Keep DOM and persistence outside Course. Run real-code assertions and manually verify plan setup, unlocking, shared learned state, and plan quiz effects.

### Content

Use the [data pipeline](data-pipeline.md). The prebuilt JSON is sufficient to run Pengo, but not all rebuild sources are included. Review generated diffs and ID changes, refresh the fallback bundle last, and restage assets before native testing. Avoid hand-editing JSON when a generator/source change can produce the result.

### Persistence or native behavior

Export a backup from a disposable profile before experimenting. Check old-backup imports, replacement semantics, theme application, origin changes, and Android document picker/Back behavior. Native changes require a rebuilt APK; browser refresh cannot exercise Java code.

## Debugging

In browser developer tools, inspect `DB.loaded`, `DB.source`, the data indexes, and `store` as lexical bindings. `window.DB`/`window.store` need not exist. `localStorage.getItem('knowkanji:v1')` reads persisted JSON. `window.KKDiag.stroke` reports the last stroke loader diagnostic.

Preserve backups before deleting local data. Storage is origin-scoped: switching port, hostname, scheme, browser profile, or native runtime can make an existing store appear missing. See [maintenance](maintenance.md) for symptoms and recovery.

## Completion criteria

A change is reviewable when its source diff is scoped, meaningful checks are recorded, generated artifacts are consistent if affected, and owning docs describe the new behavior. There are no checked-in CI gates; do not assume a pipeline will perform missing checks.
