# Deployment and releases

Voice/audio assets are retired. Run `python3 scripts/build_components.py` after updating KanjiVG SVGs or mnemonics. Ship `data/components.js` with the runtime; `sync_www.py` removes legacy audio and pronunciation files from an existing staging directory. No synthesis/model dependencies are required.

## Static web staging

Build a runtime-only directory with the existing packaging script:

```sh
python3 scripts/sync_www.py
```

The default output is ignored `www/`. Upload its contents to a static host, retaining paths and UTF-8 filenames. Hash routes require no server rewrites. Deploying only root HTML/CSS/JS will omit data, branding, or stroke art.

### Runtime inventory

| Inventory | Paths |
| --- | --- |
| Root files | `index.html`, `app.js`, `onboarding.js`, `course.js`, `practice.js`, `practice-ui.js`, `components.js`, `recall-ui.js`, `dashboard.js`, `reminders.js`, `reminder-worker.js`, `design.js`, `platform.js`, `styles.css`, `manifest.webmanifest` |
| Full directories | `assets/`, `data/` |
| Resource subset | `resources/stroke-order/`, `resources/CREDITS.md` |

Docs, raw vocab/grammar input packages, Python, Java, build tools, and optional tokenizer dependencies are not needed at runtime. The whole `data/` directory is copied, so do not place private files there. `sync_www.py` creates/merges output but does not delete obsolete files; for release staging choose a fresh output directory or clean only an explicitly disposable build directory.

Check the package locally with a static server and the [acceptance matrix](testing.md). No publishing provider or CI deployment workflow is configured in this repository.

Hosted web offline reloads are not guaranteed: explicit browser reminder opt-in registers a notification-only worker with no caching. Serve over HTTPS (localhost is suitable for development) for browser notification APIs. The worker and script paths must retain the app's deployment subdirectory. Browser localStorage is tied to the deployed origin, so changing hostname/scheme/port changes the store available to that installation.

## Checked-in native Android shell

| Field | Current source value |
| --- | --- |
| Activity | `android/app/src/main/java/com/knowkanji/app/MainActivity.java` |
| Application ID/namespace | `com.knowkanji.app` |
| Display name | Pengo |
| compile/target SDK | 34 |
| Minimum SDK | 24 |
| Java source/target | 17 |
| Android Gradle Plugin | 8.5.2 |
| Gradle distribution reference | 8.7 |
| versionCode/versionName | 1 / `1.0.0` |
| Native start URL | `file:///android_asset/www/index.html` |
| Internet permission | Not declared |
| Speech service visibility | `TTS_SERVICE` intent query; no additional permission; installed offline Japanese voice required |
| Reminder permissions | `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`; no exact-alarm permission |
| Platform backup | `android:allowBackup="true"` |

These are repository values, not claims of compliance with current distribution-store requirements. The app is a framework Activity/WebView and has no Capacitor Android dependency in its Gradle project.

### Local debug build

Install JDK 17, Android SDK platform 34 and build tools (the Dockerfile selects 34.0.0), and Gradle on PATH. SDK discovery can use `ANDROID_HOME`/`ANDROID_SDK_ROOT` or local Gradle SDK configuration in ignored `android/local.properties`.

```sh
python3 scripts/build_apk.py
```

The script:

1. Runs `sync_www.py` into `www/`.
2. Removes/replaces `android/app/src/main/assets/www/` with that staged tree.
3. Uses the wrapper only if `gradle-wrapper.jar` exists, otherwise searches PATH for Gradle.
4. Runs `:app:assembleDebug` in `android/`.
5. Copies `android/app/build/outputs/apk/debug/app-debug.apk` to `dist/pengo-debug.apk`.

Only `gradle-wrapper.properties` is checked in; the wrapper JAR and launcher scripts are absent. Their mere referenced distribution does not make `./gradlew` available. Use system Gradle (8.7 matches Docker/reference configuration) or add a complete wrapper as an intentional toolchain change.

For staging without Java/SDK/Gradle:

```sh
python3 scripts/build_apk.py --assets-only
```

The script does not rebuild content or `bundle.js`. Its native-asset replacement is generated work; edit the root source before staging. The upstream web staging merge can retain obsolete files that are then recopied to native assets.

### Docker debug build

With the Docker CLI/daemon available, run from the repository root:

```sh
python3 scripts/build_apk_docker.py
```

The script builds `docker/Dockerfile` for `linux/amd64`, creates a container, copies the APK out, and removes the extraction container. Defaults are image tag `knowkanji-builder` and container name `kk-apk-extract`. It accepts `--tag NAME` and `--no-cache`.

The image starts from `gradle:8.7-jdk17`, installs Python/curl/unzip and Android command-line tools, accepts SDK licenses, installs platform/build tools 34, copies the repository, and runs the same debug builder. First builds need network for images/toolchain/dependencies and substantial disk space. ARM hosts use the selected amd64 platform; elapsed build time varies.

The fixed extraction container name is removed before creation, so concurrent builds can collide. `.dockerignore` excludes generated folders, node_modules, Git metadata, and local Android SDK config. No signing secrets should be added to the build context.

### Installation and native checks

Install the debug APK with a device file manager or, when adb is available:

```sh
adb install -r dist/pengo-debug.apk
```

Test cold startup and stroke diagrams in airplane mode, intro skip/replay/swipe, orientation changes, Back navigation, dark system bars, document picker export/import/cancel, and reload persistence. See T-15 in [testing](testing.md). Same application ID/signing identity is required for a normal update install; export a backup before uninstalling or changing identity.

For reminders, use T-16: explicit opt-in/denial, local-time delivery with the app closed, notification tap/resume, goal suppression, turn-off, reboot/timezone restoration, and battery restrictions. Inexact alarms can be delayed and are not guaranteed appointments. Native automated checks run with `npm run test:android` after staging assets; JUnit 4.13.2 and Robolectric 4.16.1 are test-only Gradle dependencies, not shipped notification services. See [testing](testing.md#native-reminder-tests).

## Optional Capacitor configuration

`package.json` declares CLI/Core/Android `^6.0.0`; `capacitor.config.json` identifies Pengo, `www`, and an HTTPS Android scheme. It is optional scaffolding. The checked-in `android/` is already a standalone native project, so `npx cap add android` cannot simply add the same platform directory; `cap sync` is not the native builder's staging step.

A genuine Capacitor path needs an isolated project/directory and explicit native integration. The runtime has conditional Capacitor detection/Back handling, but `@capacitor/app` is not declared and no complete App-plugin bootstrap is shipped. Native document-picker methods are supplied by `KnowKanjiNative`, not a built-in Capacitor implementation here. Do not assume equivalent behavior from installing the optional packages.

## Release preparation

The repository currently automates **debug APKs**. A release build type exists with minification off, but there is no release signing configuration, key management, store metadata, or automated release pipeline. Prepare those explicitly before production distribution.

For a concrete release candidate:

1. Record the source revision and content provenance; review known gaps and ID/backup compatibility.
2. Align relevant version strings: `APP_VERSION` in `platform.js`, npm package version, and Gradle `versionName`; increment native `versionCode` when preparing an update.
3. Run meaningful tests and content/bundle checks; stage a clean runtime inventory.
4. Build and verify the candidate on target platforms, including offline native use and backup roundtrip.
5. Include resource credits and resolve source/application distribution permissions as applicable.
6. If production Android distribution is intended, add signing/distribution configuration and evaluate current target platform requirements for that release.

This is a release procedure, not evidence that a production release is ready. Avoid changing legacy `knowkanji` storage/package/application IDs merely to align branding.

## Rollback and recovery

Retain the previous web/runtime artifact and source revision. Web rollback replaces the entire staged artifact; refreshing data without matching `bundle.js` produces mixed versions. User progress is not rolled back with static files, so preserve compatible storage/IDs.

Android rollback depends on version/signing/install rules and is not automated. An uninstall can remove WebView data; export/import is the available user transfer mechanism. There is no server copy to restore. Do not imply that rehosting or rebuilding recovers local-only progress.
