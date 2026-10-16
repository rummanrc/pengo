# F-Droid inclusion request — draft

Publication status and historical-source cleanup are recorded in `docs/fdroid.md`.

- Name: Pengo
- Application ID: `io.github.rummanrc.pengo`
- Source: https://github.com/rummanrc/pengo
- License: Apache-2.0 for application code; bundled content has separate terms
- Release: planned `v1.0.0`, version code `1` (tag not published yet)
- Summary: Offline Japanese study with kanji, vocabulary, grammar and daily practice

Pengo is an offline Japanese learning application with a native Android WebView shell. It includes bundled study content, animated stroke diagrams, short quizzes, saved sessions, study plans, progress tracking, system document pickers for backups, and opt-in OS-scheduled reminders. It has no advertising, analytics, accounts, Google Play Services or runtime network permission.

The Android project uses Gradle 8.7, Android Gradle Plugin 8.5.2, JDK 17, compile/target SDK 34 and min SDK 24. Python 3 stages the checked-in static runtime before Gradle assembly; no npm install, content regeneration, external data downloads or proprietary IDE is required. The checked-in optional Capacitor dependencies are not used by this build. JUnit and Robolectric are test-only dependencies.

Proposed build metadata is in `fdroid/metadata/io.github.rummanrc.pengo.yml`. Store descriptions, icon and browser-rendered screenshots are under `fastlane/metadata/android/en-US/`. F-Droid should build from source and use its own app signing key; developer-signature reproducibility is not requested.

This draft is not an inclusion request that has already been filed, and local build checks do not establish F-Droid acceptance.
