# Security and privacy

This describes the inspected implementation and its trust boundaries. It is not a security certification or an independent audit of resource permissions.

## Data handled

Pengo stores learned timestamps, favorites, notes, SRS due times, quiz best scores, plan settings/history, and visible-time/first-learned activity, practice attempts, saved sessions, mistake lists, and achievements locally. No account, analytics SDK, remote sync, model call, or credential storage is implemented. Web data/SVG requests go to the static host; native content is bundled and its manifest declares no internet permission.

Optional reminder time/opt-in/delivery dates are device preferences outside progress exports. Android uses local OS alarms and notification channels; browser alerts register a notification-only worker after explicit opt-in. There is no remote push server or subscription. Permission is requested only when enabling reminders, and settings honor app/channel denial. Calendar export is user initiated and transfers a generic practice event, without progress or notes, to the selected calendar. See [design and reminders](design-and-reminders.md).

“Local” does not mean encrypted. localStorage and exported JSON are plaintext at the application layer. A static host can have its own access logging. Android declares `allowBackup=true`, so platform/device backup policy can affect app data; the repository does not implement custom backup encryption or exclusions.

## Trust boundaries

| Boundary | Existing handling | Limit |
| --- | --- | --- |
| Ordinary record/note text → DOM | `esc()` in text/attributes | Review any newly added raw interpolation |
| Generated furigana/explanations → DOM | Offline HTML generation; grammar sanitizer allows `b`/`i`/`br` | Raw HTML remains trusted runtime markup; no general runtime sanitizer |
| KanjiVG file → DOM | Parse as SVG then insert | No general SVG content sanitizer |
| Backup file → store | JSON parse, recognized top-level key, container normalization | Practice session reference/shape validation is present; no complete schema, size, SRS/course validation |
| Java import text → evaluated JavaScript | `JSONObject.quote` encodes text as a string | Full-file read; no import-size bound |
| Web JavaScript → native bridge | Explicit annotated methods, UI-thread dispatch | Reachable by loaded WebView content; no separate origin authorization |
| Runtime files → hosted users | Static deployment | Integrity depends on trusted host/artifact; no CSP/SRI configured |

## Persistence and backups

`save()` catches quota/blocked-storage failures and displays a persistent notice directing the user to export a backup. The app still holds the in-memory state, so exporting can preserve it. A visible change or successful import message may not survive restart. Export before clearing browser data, switching origin/device, uninstalling, or changing native identity. Backups contain personal notes/activity and should be treated as user data.

Import replaces current state and has no confirmation preview. It accepts a broad object with at least one known progress field and preserves unknown properties. Top-level maps are normalized, but malformed nested values can trigger rendering/scheduler errors. A full storage migration framework and dataset-version envelope are absent.

Erasure requires an explicit UI confirmation, resets the main store, removes the intro flag, and resets/cancels device reminders. It does not revoke OS permission, delete exported files or external/device backups, or remove calendar events already imported elsewhere. It writes a default store rather than purging every localStorage key on the origin.

## Native configuration

The WebView enables JavaScript, DOM/database storage, file access, and file-to-file access; it disables universal file-to-other-origin access. It loads local app assets. `shouldOverrideUrlLoading` returns false without a URL allowlist, and the Java bridge stays installed for loaded content. No internet permission limits network access, but does not constitute a complete navigation/bridge policy.

Before adding external links, remote content, new bridge methods, or internet permission, define which URLs may run inside the bridged WebView and which should open externally. Review document-picker cancellation/error behavior and concurrent exports. Current import reads arbitrary selected JSON/text files in full and passes them to the JavaScript validator.

## Content supply chain

Resource data and SVGs are application inputs with rendering consequences. Grammar HTML sanitation occurs at build time, not at arbitrary runtime import. Backups store progress, not a replacement content dataset, but malformed progress still affects rendering logic.

The metadata refresh script downloads from an upstream URL; Docker downloads build images/toolchain, and Gradle can resolve dependencies. npm optional packages use ranges without a lockfile. These are build-time dependencies. Keep source provenance, inspect generated changes, and rebuild matching fallback content. Existing local [credits](../resources/CREDITS.md) should accompany distribution; unresolved source permissions are listed there.

## Proposed hardening if scope expands

The following are follow-up options, not implemented protections:

- Versioned deep backup validation with size bounds and an import preview/confirmation.
- Deeper recovery/import validation beyond the existing persistence-error notice.
- A native navigation allowlist and bridge exposure policy before introducing remote pages.
- Explicit trusted-content markup rules and CSP suitable for current classic scripts/inline markup.
- Pinned build inputs/dependencies and reproducible artifact records.

Validate these against required product behavior before adopting them. For current confirmed limitations and debugging, see [maintenance](maintenance.md).
