# Maintenance and troubleshooting

Preserve an exported backup before investigating user-state problems. Use a disposable profile/copy to reproduce failures; do not erase real progress as a diagnostic step.

## Troubleshooting

| Symptom | Likely cause/check | Recovery |
| --- | --- | --- |
| Data-load error on startup | Required JSON failed and bundle could not load | Serve via HTTP; check paths, JSON validity, and `data/bundle.js` |
| Empty vocab/grammar but kanji works | Optional requests failed to empty arrays | Inspect Network requests; restore full staged `data/` |
| HTTP and file/native show different content | JSON changed without matching fallback bundle | Rebuild bundle after final JSON changes, then restage/rebuild |
| Missing stroke art | Absent SVG, blocked file fetch/XHR, stale `hasStroke`, parse failure | Check `<cp>.svg`, `window.KKDiag.stroke`, HTTP/native behavior |
| Blank/hidden app during intro | Boot gate or failed script/data load | Check console, script order, `ob-boot` handling, load failure path |
| Progress seems missing | Origin/profile changed, storage cleared, native identity changed | Return to original origin/profile or import an exported backup |
| Progress disappears after restart | Full/blocked localStorage or malformed stored data | Test storage in disposable profile; preserve/export current state; diagnose permissions/quota |
| Import reports unrelated/invalid file | Not a main-store backup or invalid JSON | Use original `pengo-backup.json`; inspect a copy |
| Import succeeds then view fails | Nested malformed course/SRS values or missing IDs | Preserve file, reproduce in disposable profile, repair through a reviewed migration |
| Intro reappears | Flag missing/blocked, erase, new origin, or `?onboarding=1` | Remove preview query; finish intro; check separate onboarding key |
| Course batch changed after update | Derived curriculum changed with pace/data | Compare counts/order/IDs and retained `unlockedDay`; document migration |
| Streak differs from Progress days | Course study days and visible-time activity are separate | Inspect `course.studyDays` versus `study.days`; see course rules |
| “No Gradle found” | Incomplete wrapper and no system Gradle | Install configured toolchain or use Docker build |
| Docker build/extraction fails | Daemon unavailable, network/toolchain failure, fixed container collision | Start daemon, inspect build logs, run builds serially |
| Native still shows old UI | Source edited but packaged assets/APK unchanged | Stage from final root sources and rebuild/install |
| Reminder remains off after Enable | Permission denied, app/channel blocked, unsupported/insecure browser, or storage failure | Read Settings status; explicitly allow notifications or import the calendar event |
| Browser reminder absent after closing Pengo | Open-page alerts have no push backend | Keep a tab open or use the calendar option |
| Native reminder late or skipped | Inexact alarm, power restrictions, goal already met, same-day delivery, or stale alarm | Check chosen time/goal/notification settings; test explicitly; see reminder limits |
| Calendar reminder persists after Pengo turn-off | Imported event belongs to external calendar | Edit/delete that recurring event in the calendar app |

Useful navigation:

```sh
rg -n 'loadData|bootFailed|KKDiag|importBackupText|save\(' app.js
rg -n 'FILES|DIRS|EXTRA|find_gradle' scripts
git diff --stat
git status --short
```

## Confirmed gaps at documentation time

This register retains original IDs and now identifies fixes from the daily practice implementation. It is not an exhaustive defect audit. Priority below is a suggested order for release planning; ownership and disposition remain unset.

| ID | Gap | Practical impact | Suggested next step |
| --- | --- | --- | --- |
| K-01 | Raw vocab CSVs/Tatoeba TSV/grammar Anki source absent | Full content rebuild cannot be reproduced | Recover exact inputs and provenance; preserve ID compatibility |
| K-02 | Source credits report unresolved terms; no root application license | Company distribution has unresolved ownership/permission questions | Assign content/application rights review before public release |
| K-03 | Debug-only automated APK flow; incomplete wrapper | No ready production signing/distribution pipeline | Define release identity/signing and complete reproducible toolchain |
| K-04 | Shallow backup validation remains; storage failures now show a notice | Malformed nested imports can still break unrelated views | Add versioned deep validation/limits; practice sessions already validate content references |
| K-05 | Fixed: all quizzes grade SRS and due-only practice is available | Due counts lead to actionable practice | Covered by practice unit/browser checks |
| K-06 | Fixed: selected content filters determine practice queues | Combined due pill intentionally covers all types | Covered by due content-filter checks |
| K-07 | Overlapping kanji lists overwrite global detail index | Detail level may differ from entry list; progress shared by character | Preserve/document identity or redesign level-specific resolution |
| K-08 | Ordinal/occurrence IDs depend on source order | Content refresh can misassign or strand stored progress | Diff ID→record mappings; define migrations before source changes |
| K-09 | `sync_www.py` merges without removing obsolete files | Clean source can still yield stale packaged assets | Stage into fresh directory or add safe clean-staging behavior |
| K-10 | No hosted-web offline caching; notification-only worker now exists | Hosted offline reload is not guaranteed | Keep claims precise; add caching only if product scope requires it |
| K-11 | Capacitor scaffolding is not equivalent to native shell | Straight add/sync commands can conflict or miss native behavior | Isolate and implement a deliberate Capacitor integration |
| K-12 | Partly fixed: Node, practice/design browser, and native reminder tests now exist | Physical-device, other native bridge, and pipeline coverage remain incomplete | Run relevant suites; add remaining coverage when changing those areas |
| K-13 | No native URL allowlist with bridge installed | Future external navigation changes need careful boundary design | Define navigation policy before adding remote pages/permission |
| K-14 | Combined kanji search threshold breaks inner loop only | Kanji result count can exceed intended 120 limit | Stop outer iteration too if enforcing a shared bound |
| K-15 | No central cancellation for asynchronous view work | Rapid navigation may leave timers/responses targeting stale views | Add lifecycle checks if reproducing stale updates |
| K-16 | Fixed: intro now describes short quizzes and recall cards | Mock exams remain a separately scoped content project | Copy matches shipped practice |
| K-17 | Pace recommendation has caps and dates are generated estimates | Suggested pace may miss a close exam; venue dates unverified | Show limits; agree planning/calendar behavior |

For company tracking, link these IDs from the [risk and change register](delivery/register.md) instead of copying a second defect description.

## Content and incident handling

For a content error, record level, record ID/character, wrong field, expected text, source evidence, and a screenshot if useful. Trace to the generator/input, fix at the source where possible, regenerate matching outputs, and review representative examples. Do not assume substring matches or furigana are linguistically correct just because syntax checks pass.

For a release failure, record source revision/artifact, platform, steps, console/native logs, and whether data was affected. Avoid collecting unredacted backups without consent: notes/activity can contain personal information. A host/APK rollback does not restore local-only progress; use the exported backup route and compatible IDs.

Known limitations should be closed only after a scoped implementation change and evidence. See [daily learning improvements](learning-improvements.md) for shipped changes and remaining content work.
