# Architecture

Pengo is a static single-page application with classic scripts and hash navigation. It has no framework, bundler, backend, or remote persistence. A Java Android activity loads the same files from application assets.

## Runtime components

```mermaid
flowchart TD
    User["Learner"] --> Shell["index.html: shell"]
    Shell --> App["app.js: router, views, quizzes, store"]
    App --> Course["course.js: pure scheduling"]
    App --> Practice["practice.js: pure practice rules"]
    App --> PracticeUI["practice-ui.js: shared player and motivation"]
    App --> Design["design.js: adventure views and mascot"]
    App --> Reminders["reminders.js: device reminders"]
    Reminders --> DevicePrefs["Device-only preferences"]
    Reminders --> Worker["reminder-worker.js: browser notification taps"]
    Reminders --> Bridge
    App --> Content["data JSON or bundle.js"]
    App --> SVG["resources/stroke-order: SVGs"]
    App --> Storage["localStorage: knowkanji:v1"]
    Shell --> Intro["onboarding.js"]
    Intro --> Flag["localStorage: pengo:onboarded:v1"]
    App --> Platform["platform.js"]
    Platform --> Browser["Browser file/share APIs"]
    Platform --> Bridge["KnowKanjiNative Java bridge"]
    Bridge --> Android["Android document picker and system bars"]
    Bridge --> Alarm["StudyReminders: OS alarm and channel"]
    Alarm --> Receiver["ReminderReceiver: deliver and reschedule"]
    Receiver --> Notification["Android notification: short practice entry"]
    Shell --> Style["styles.css and assets/"]
```

`app.js` owns data indexes, mutable progress, routing, and views. `course.js` computes plan behavior without DOM/storage access. `practice.js` computes selection, SRS scheduling, session validation, and motivation statistics; `practice-ui.js` owns the shared player. `design.js` supplies adventure Home, real progress cards, quick choices, and mascot presentation. `reminders.js` supplies device preferences and explicit browser/native opt-in. Platform adapts native/browser operations, although app/reminder scripts also call the native bridge directly. Onboarding owns its overlay and completion flag.

| Component | Responsibility | Dependencies |
| --- | --- | --- |
| `index.html` | Shell DOM, metadata, early intro gate, script order | CSS, assets, classic runtime scripts |
| `app.js` | Loading/indexing, routes, rendering, persistence, quiz/SRS integration | DOM, Course, Platform, onboarding, local files |
| `course.js` | Dates, pace, order, batches, sampling, streaks, milestones | Built-ins and state callbacks |
| `practice.js` | Pure practice selection, grading, validation, goals, badges | Course and built-ins |
| `components.js`, `data/components.js` | KanjiVG hierarchy and existing story-reference views | Generated component data, app facts |
| `recall-ui.js` | Resumable tap-to-flip player, explicit recall ratings and swipe navigation | Practice, Course, activity ledger |
| `dashboard.js` | Pure daily subject totals, rotating challenges and date-based discovery | Course, Practice, activity ledger |
| `JapaneseSpeech.java` | Lazy offline Japanese engine, request lifecycle and queue replacement | Android TextToSpeech |
| `practice-ui.js` | Shared quiz/recall player, session summaries, daily dashboard | App globals, Practice, Course |
| `design.js` | Adventure Home, learning trail, progress cards, tips, quick starts | App globals, Practice, Course, Reminders |
| `reminders.js` | Device opt-in, native goal sync, browser alerts, calendar file | Browser APIs, optional native bridge |
| `reminder-worker.js` | Notification tap navigation | Service-worker clients API; no caching |
| `platform.js` | Detection, export, import callback, theme, Back | Browser APIs, optional native globals |
| `onboarding.js` | Intro slides, touch navigation, first-launch decision | DOM, Platform, localStorage |
| `styles.css` | Themes, shell, feature styles, responsive/motion rules | Shell and renderer classes |
| `MainActivity.java` | WebView, bridge, document results, Back/lifecycle | Android framework, packaged files |
| Native reminder classes | Local-time alarms, permission/channel checks, delivery, boot/clock restoration | Android framework, SharedPreferences |
| Python scripts | Content transformation, web/APK staging | Filesystem and optional build tools |

## Startup

Script order is `platform.js` → `onboarding.js` → `course.js` → `practice.js` → `data/components.js` → `components.js` → `recall-ui.js` → `practice-ui.js` → `reminders.js` → `dashboard.js` → `design.js` → `app.js`. These are classic scripts, not ES modules. UI/reminder functions access app globals only after initialization. Top-level `const`/`let` such as `DB` and `store` are global lexical bindings, not necessarily properties on `window`. Course uses `var`; Platform and APP_VERSION are explicitly exported on `window`.

```mermaid
sequenceDiagram
    participant H as index.html
    participant A as app.js
    participant L as Local files
    participant O as onboarding.js
    participant V as View
    H->>A: Load scripts in dependency order
    A->>A: Read and normalize store, migrate activity
    A->>L: Start JSON requests in parallel
    alt First native launch or web preview
        A->>O: Show intro while data loads
        O-->>A: Finish or skip, save intro flag
    else Intro not needed
        A->>A: Wait for data
    end
    alt Required JSON load fails
        A->>L: Load data/bundle.js as script
        L-->>A: window.KK_DATA
    else JSON succeeds
        L-->>A: Content arrays and metadata
    end
    A->>A: Build indexes and set DB.loaded
    A->>V: Initialize chrome, clear gate, render
```

Data and intro run concurrently. Rendering waits for both. The failure handler clears the visibility gate and shows the data-load error. Kanji level files and `meta.json` are required by the fetch path; radicals/vocabulary/grammar catch individual failures, so absent optional data may not trigger bundle fallback.

## State and rendering

Content lives in `DB.levels`, `DB.vocab`, and `DB.grammar`, with `byChar`, `vById`, and `gById` indexes. The mutable `store` holds learned state, favorites, notes, SRS, settings, plan configuration, activity, and practice session/history/achievements. Content itself is excluded from backups.

Handlers mutate the store and call `save()`, which serializes the whole object into `knowkanji:v1`. There is no transaction log, cross-tab coordination, or server acknowledgement; storage errors show a persistent export-backup notice. The saved practice session is validated against loaded content before use, and answered questions resume as feedback without regrading. Curriculum is derived on demand, so changed data/pace may change numbered batches.

`parseHash()` decodes route segments/query pairs. `render()` selects a view, updates navigation, binds mascot tips, focuses `#view`, and scrolls to the top (or the requested reminder section). Most renderers replace `innerHTML` then bind handlers. Browse search changes only results and replaces history state to preserve focus. Hash routing requires no server route rewriting.

## Native packaging

```mermaid
flowchart LR
    Source["Runtime files, data, SVGs, credits"] --> Sync["sync_www.py"]
    Sync --> WWW["www/"]
    WWW --> Assets["Android assets/www/"]
    Assets --> Build["Gradle assembleDebug"]
    Build --> APK["dist/pengo-debug.apk"]
    APK --> View["MainActivity: local WebView"]
```

The bridge is installed as `window.KnowKanjiNative` before loading `file:///android_asset/www/index.html`. Export opens `ACTION_CREATE_DOCUMENT`; import opens `ACTION_OPEN_DOCUMENT`, reads UTF-8, quotes the text with `JSONObject.quote`, then invokes `Platform.receiveImport`.

Android Back evaluates `KKBack()`: intro gets first opportunity, then Platform navigates browser history off Home. Java falls back to activity Back when JavaScript returns false. Activity recreation saves/restores WebView state; localStorage remains the durable progress store.

Native reminders use SharedPreferences outside progress backups and an OS-owned inexact alarm. Receivers deliver and restore opted-in schedules independently of the WebView; notification entry opens short practice. Browser reminders need an open page and use a notification-only service worker. See [design and reminders](design-and-reminders.md) for lifecycle, permission, timezone, and calendar behavior.

## Boundaries and constraints

Native assets work offline and the manifest has no internet permission. Hosted web visits still depend on the host for uncached files; the manifest alone supplies no caching. Build-time downloads are separate from runtime access.

Kanji indexes keep the last encountered record across overlapping levels while progress is shared by character. Vocabulary/grammar ID changes can strand stored state. Raw content HTML and SVG cross a trust boundary. Platform origins differ, so backup export/import is the implemented transfer mechanism.

Optional Capacitor declarations are scaffolding, not the implementation of the checked-in Java activity. See [deployment](deployment.md) and [decision records](decisions.md) for related tradeoffs.

Voice pronunciation and native TTS were removed on 2026-10-09. Discovery cards use the existing practice session and SRS; revealing earns no progress, ratings do. Component data loads through a classic script in both HTTP and file:// modes. See [discovery cards](discovery-cards.md).
