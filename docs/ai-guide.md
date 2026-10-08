# AI guide to Pengo

Pengo is a static JavaScript Japanese-learning app plus a Java Android WebView shell. Read this before making changes. These are project navigation/compatibility notes, not invented user approvals or a substitute for task instructions.

## Read only what the task needs

| Task | Start here | Supporting docs |
| --- | --- | --- |
| Shell/theme/responsive UI | `index.html`, `styles.css`, `design.js`, relevant renderer in `app.js` | [Frontend](frontend.md), [design/reminders](design-and-reminders.md) |
| Browse/search/details | `match*Query`, `render*Browse`, `bindBrowseSearch`, detail renderers | [Frontend](frontend.md), [data model](data-model.md) |
| Plan/curriculum | `course.js`, `course*` helpers and `renderCourse*` in `app.js` | [Course](course.md), [interfaces](interfaces.md) |
| Ordinary quizzes | `renderReview`, `renderQuiz`, `renderVQuiz`, `renderGQuiz` | [Product](product.md), [testing](testing.md) |
| Progress | `recordStudyItem`, `migrateStudyItems`, `flushStudyTime`, `renderProgress` | [Data model](data-model.md) |
| Backup/storage | `defaultStore`, startup normalization, `save`, import/export; Platform/Java bridge | [Data model](data-model.md), [security](security.md) |
| Content/furigana | Relevant `scripts/build_*.py`, `furigana.py`, `sudachi_furigana.py` | [Pipeline](data-pipeline.md) |
| Android | MainActivity, manifest, Gradle, packaging scripts | [Deployment](deployment.md) |
| Reminders | `reminders.js`, worker, native reminder classes/tests | [Design/reminders](design-and-reminders.md), [interfaces](interfaces.md) |
| Company handover | Documentation, current evidence, open gaps | [Company delivery](company-delivery.md) |

## Facts to preserve

- No npm install/build is needed for web or checked-in native staging. Do not introduce a server/framework without task scope.
- Classic script order is Platform → onboarding → Course → Practice → component data → components → recall UI → practice UI → Reminders → Dashboard → design → app. `DB`/`store` are lexical globals; do not assume `window.DB`.
- `knowkanji:v1`, `com.knowkanji.app`, npm name `knowkanji`, and legacy `KK*` hooks remain compatibility identifiers despite Pengo branding.
- Kanji progress is by character across overlapping level lists; global details resolve the last indexed occurrence.
- Vocab/grammar IDs can change if sources are reordered. Review ID→record mappings before regeneration.
- All Review/plan entry points share the practice player and grade SRS/activity. Due-only review and recall cards are exposed through `#/practice`.
- Plan unlocking is explicit and progress-based; dates do not skip batches. Pace/data changes derive new batches.
- Main backup replaces state and excludes onboarding/content/device reminders. It is not a cloud-sync merge format.
- Hosted web has a notification-only worker after opt-in, with no offline caching or closed-page push. Native offline behavior depends on a complete packaged runtime.
- Reminders default off and permission requests require explicit Enable. Preserve goal/duplicate suppression and device-preference isolation from imported progress.
- Raw vocab/Tatoeba/grammar builder inputs are absent here. Existing data can run/package without them.
- `resources/` is ordinary tracked content in this checkout, not a configured submodule.

## Change boundaries

Edit root runtime sources, not ignored `www/`/native staged assets. Preserve resource credits. Rebuild `data/bundle.js` after any JSON change and restage after source/content is final. Add new runtime files to the packaging inventory when needed.

Keep Course pure and ES5-compatible with dukpy; put browser persistence/DOM in app integration. Browse input handling updates results without rebuilding focused inputs. Escape ordinary content; only trusted generated markup should enter raw HTML paths.

Do not treat optional Capacitor declarations as a fully working alternative native project. No complete wrapper or production signing pipeline is present. Missing dukpy exits the test script successfully with `SKIP`; inspect its output.

## Validation and reporting

Use [testing](testing.md) for checks that match the change. Documentation work can validate links/source claims and syntax without changing product behavior. Report the engine/platform actually used and manual checks actually performed. A parsed diagram is not visual UI testing, and Node course assertions do not prove dukpy compatibility.

Use [maintenance](maintenance.md) to distinguish known gaps from requested work. Do not silently fix every gap while performing a documentation or CSS task. Proposed delivery targets, review records, and approval fields must remain marked proposed/unassigned until actual decisions occur.

## Useful commands

```sh
git status --short
rg -n 'function render|function course|STORE_KEY' app.js
rg -n 'function |return \{' course.js
rg --files scripts tests docs android
python3 -m http.server 8000
```

The [documentation index](README.md) links the full engineering set. Source code wins if a dated document and implementation disagree; update the affected document when changing the contract.
