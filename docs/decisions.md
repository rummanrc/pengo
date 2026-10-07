# Observed architecture decisions

These records describe choices evident in the current code. They are not reconstructed historical approvals. Each status is **Observed**, and the tradeoff discussion is an engineering interpretation recorded on 2026-10-07.

## D-01: Static runtime with hash routes

**Evidence:** `index.html`, `app.js` router, relative asset paths, and no frontend build script/backend.

Pengo delivers classic scripts and static data directly. This supports simple local hosting and a shared native asset package. The cost is a large application script, runtime-global dependencies, full dataset loading, and manual lifecycle management. A framework migration would need to preserve routes, offline packaging, and stored state rather than just visual appearance.

## D-02: Generated content plus fallback script bundle

**Evidence:** JSON builders, `build_bundle.py`, `loadData()`.

Content transformation happens offline; the runtime loads JSON normally and a duplicated script bundle on required-load failure. This supports local-file environments without runtime CSV/Anki/tokenizer dependencies. The cost is artifact duplication and a freshness contract: every content change must update the bundle. Source availability and stable IDs remain necessary for reproducible updates.

## D-03: One local progress store

**Evidence:** `STORE_KEY`, `defaultStore()`, `save()`, direct store backup.

Most user state is serialized into `knowkanji:v1`, with the onboarding flag separate. This makes offline export/import straightforward. The cost is whole-object writes, origin-specific storage, no conflict resolution/server recovery, silent write failure, and shallow migration/validation. A future cloud feature must define merge semantics and privacy rather than assuming backups already provide sync.

## D-04: Pure course module over shared content/state

**Evidence:** `course.js` has no DOM/storage calls, accepts callbacks, exports CommonJS; app integration references existing records.

Curriculum, order, sampling, streaks, and milestones can be tested against actual code without a browser. The app owns grading/persistence. Derived curriculum avoids storing duplicate content, but source/pace changes can alter batch membership while numeric unlock position remains. Shared progress gives coherent cross-view state; pure-module tests do not validate integration effects.

## D-05: Java WebView shell for Android

**Evidence:** `MainActivity.java`, no native Capacitor dependency, APK staging scripts, manifest without internet permission.

The same static runtime runs inside a minimal Java activity, with a small bridge for backups/theme/version. This avoids requiring Node for the checked-in native build and supports offline assets. The cost is manual Back, lifecycle, document-picker, navigation security, and build/release maintenance. Optional Capacitor declarations are a separate path needing implementation.

## D-06: Kanji identity is the character

**Evidence:** `DB.byChar`, learned/note/favorite/SRS maps, overlapping level lists.

Progress naturally follows a character across levels. The cost is that detail indexes keep the later-level record and per-level counts are not distinct global counts. Vocabulary/grammar instead use generated level-qualified IDs with different stability concerns. Any redesign requires backup/ID migration and explicit decisions about shared versus per-level progress.

## D-07: Current Review is quiz practice; plan quiz grades SRS

**Evidence:** `renderQuiz`, `renderVQuiz`, `renderGQuiz` versus `renderCourseQuiz` → `courseGrade`.

Ordinary quizzes provide immediate feedback/best scores; plan quizzes affect shared review state. The code retains due counters/SRS helpers without a routed due-only session. This distinction is documented current behavior, not evidence of an intentional product approval. A review redesign should state whether ordinary quizzes grade, what due counts mean, and how learned flags interact with wrong answers.

## Future decision record format

For a new architectural change, record ID/date, status (proposed/accepted/superseded), concrete context, chosen behavior, alternatives considered, state/route/content compatibility, consequences, reviewer/decision evidence, and related requirement/test IDs. Use [the review template](delivery/review-and-acceptance.md) when formal delivery records are needed.
