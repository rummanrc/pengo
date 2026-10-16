# F-Droid release

## Build and identity

The Android release application ID and namespace are `io.github.rummanrc.pengo`.
Debug installs use `io.github.rummanrc.pengo.debug` so a debug certificate cannot
block installation of the F-Droid-signed app. Native bridge methods are exposed
through `PengoNative`. Current release version: `1.0.0`, version code `1`.

Build an **unsigned** release with JDK 17, Android SDK 34/build tools and Gradle 8.7:

```sh
python3 scripts/build_apk.py --release
```

Or use Docker Desktop:

```sh
python3 scripts/build_apk_docker.py --release
```

Both write `dist/pengo-release-unsigned.apk`. This is a build artifact for
inspection, not an installable public release. The official F-Droid repository
builds the tagged public source and signs the APK with its own key. No developer
keystore or Play-specific update SDK is needed for this route. The F-Droid client
handles discovering updates and requesting installation where necessary.

The proposed recipe in `fdroid/metadata/io.github.rummanrc.pengo.yml` stages
assets with Python and invokes Gradle's release build. It uses only checked-in
runtime data. Do not run the data regeneration pipeline for an ordinary release:
some original raw inputs are absent and item IDs must remain compatible.

## Preparation status — 2026-10-16

The owner selected Apache-2.0 for original Pengo materials and authorized making
`rummanrc/pengo` public with Git history. `LICENSE`, `NOTICE`, local third-party
license texts and refreshed in-app credits are included.

The release replaces the unlicensed Anki grammar with 595 original grammar notes
from Japanese Language Data (CC BY-SA 4.0, pinned commit and SHA-256 source hashes).
It preserves 141 matched old IDs; unmatched retired grammar state remains in
backups without being attached to unrelated notes. Source grammar is labeled as
community drafts, including in the app's credits. The old mnemonic CSV has been
removed and runtime mnemonic text is regenerated from Pengo's original templates.
The raw metadata no longer contains WaniKani enrichment and the refresh tool filters
those fields. Kanji alive radical names now have a pinned, attributed source.
See [credits](../resources/CREDITS.md) for licenses and transformations.

**Historical publication is still pending.** Older commits contain the retired
unlicensed text and enrichment. Deleting current files does not remove those old
copies. Permission to sanitize the affected Git history has been requested;
repository visibility must remain private until that issue is resolved. No public
release tag or F-Droid submission is claimed by this preparation record.

The recipe passed `fdroidserver` 2.4.5 parsing, lint, source scanning and a local
source-snapshot build with Gradle 8.7. This is local validation, not an official
F-Droid build-server run or acceptance.

The proposed recipe is `fdroid/metadata/io.github.rummanrc.pengo.yml`, and
`fdroid/submission.md` is the prepared request body. Final publication requires:

1. Resolve historical content publication while preserving a private recovery copy.
2. Finish source/build validation, commit the reviewed tree, publish public source
   and the matching `v1.0.0` tag.
3. Submit a metadata merge request to F-Droid's `fdroiddata` repository or an
   inclusion request to its submission queue. F-Droid reviews, builds and signs
   the official release; acceptance and listing are controlled by its maintainers.
4. Record the actual submission URL and, later, the F-Droid listing URL.

Physical Android acceptance and a two-version signed native upgrade remain
separate verification. Browser/Robolectric tests do not prove device behavior.

## Updating after release

Keep the release application ID and F-Droid signing lineage stable. Increase
`versionCode` for each release (`1`, `2`, `3`, ...), update `versionName`, npm's
version and `APP_VERSION` together, and publish the matching stable `vX.Y.Z` tag.
Add a Fastlane changelog named after the new version code. The recipe uses stable
version tags for update checks. Preserve storage schema compatibility and study
item IDs; test old backups and an update over a populated installation.

Existing browser profiles migrate from the pre-rename storage key to `pengo:v1`
on the same origin. Existing native debug users must export a backup from the old
app and import it into the new app, because renaming the app ID changes Android's
private storage sandbox. Keep the old app installed until the import is verified.

A later Google Play edition may use a separate signing key, as requested. Such an
edition cannot normally update the F-Droid installation in place. If both editions
must coexist, assign the Play edition a distinct application ID at that time and
transfer progress through backups.

## Sources

- [F-Droid submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- [F-Droid inclusion policy](https://f-droid.org/docs/Inclusion_Policy/)
- [F-Droid build metadata](https://f-droid.org/docs/Build_Metadata_Reference/)
