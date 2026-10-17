# F-Droid release

## Build and identity

The Android release application ID and namespace are `io.github.rummanrc.pengo`.
Debug installs use `io.github.rummanrc.pengo.debug` so a debug certificate cannot
block installation of the F-Droid-signed app. Native bridge methods are exposed
through `PengoNative`. Current release version: `1.0.1`, version code `2`.

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

The affected bundled-content paths have been sanitized throughout all 44
historical commits while preserving the commit graph and code history. Original
history is retained in a private, read-only archive and local recovery bundles.
The sanitized source is public at https://github.com/rummanrc/pengo. The original
repository was retained privately and replaced at the public URL so its retired
Git objects are not available through the public repository.

The recipe passed `fdroidserver` 2.4.5 parsing, lint, source scanning and a local
source-snapshot build with Gradle 8.7. This is local validation, not an official
F-Droid build-server run or acceptance.

The proposed recipe is `fdroid/metadata/io.github.rummanrc.pengo.yml`, and
`fdroid/submission.md` contains the original inclusion-request text for `v1.0.0`.
The [F-Droid inclusion request #4582](https://gitlab.com/fdroid/rfp/-/work_items/4582) was
submitted on 2026-10-16 for the public
[Pengo 1.0.0 source release](https://github.com/rummanrc/pengo/releases/tag/v1.0.0).
F-Droid inclusion is pending. Its maintainers control review, acceptance,
building, signing and listing; the public GitHub source release is not an
installable F-Droid release.

Physical Android acceptance and a two-version signed native upgrade remain
separate verification. Browser/Robolectric tests do not prove device behavior.

## Packaging follow-up — 2026-10-18

The RFP bot flagged the missing `distributionSha256Sum`. Version `1.0.1`
(version code `2`) pins the Gradle 8.7 binary distribution checksum from
https://services.gradle.org/distributions/gradle-8.7-bin.zip.sha256. The `v1.0.0`
release tag is preserved. The current packaging recipe targets `v1.0.1`.

The updated recipe passed `fdroidserver` 2.4.5 metadata parsing/lint, source
scanning and a complete release build cloned from the public `v1.0.1` tag at
`8938efde22da0e580ae221f07cc3a742396fd695`. All 2,520 packaged runtime/notice files
match the source. APK inspection confirms application ID `io.github.rummanrc.pengo`,
version `1.0.1`/`2`, SDK 24–34 and no internet permission. These remain local
validation results, not an official F-Droid build-server result.

The [packaging merge request !52973](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/52973) has been
submitted to `fdroid/fdroiddata`, using a public fork and a dedicated branch.
It adds only the app metadata, including author attribution and the full source
commit hash. The original RFP has a follow-up linking the MR and checksum fix.

GitLab blocked fork CI before running jobs with an account identity-verification
requirement. Following F-Droid's inclusion template, the MR requests maintainers
to trigger CI using F-Droid runners. No phone or payment information was submitted.
Official CI, maintainer acceptance and the signed repository listing remain pending.

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
