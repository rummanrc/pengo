# Product scope and requirements

Pengo supports Japanese learners preparing for JLPT N5–N1 with a reference library and daily study plan. It requires no account. Native Android carries the content on the device; web hosting serves the same static runtime.

## Primary journeys

1. Choose a level on Home, set an optional exam target and daily pace, and begin the first batch.
2. Browse kanji, words, and grammar; read examples, add notes/favorites, and mark items learned.
3. Study the current plan batch and unfinished earlier material, then answer a mixed daily quiz.
4. Practice a chosen type/level in Review, inspect Progress, and export a backup before moving devices.
5. Choose an optional local reminder time; return directly to short practice from a notification.

The intro appears automatically on a first native launch, can be previewed on the web with `?onboarding=1`, and can be replayed through Settings.

## Implemented capability requirements

These documentation IDs organize acceptance checks; they are not historical issue identifiers. T identifiers refer to the [testing matrix](testing.md#manual-acceptance-matrix), whose procedures are not claims of completed manual testing.

| ID | Capability and current acceptance criterion | Implementation | Check |
| --- | --- | --- | --- |
| P-01 | Load N5–N1 content from local runtime files | `loadData`, `loadDataFetch` | T-01, T-02 |
| P-02 | Home shows a mascot welcome and level picker without a plan, actionable learning trail with one | `renderHome`, `renderAdventureHome` | T-03, design browser suite |
| P-03 | Browse by level with search, learned/favorite filters, sorting | Three browse renderers, `bindBrowseSearch` | T-04 |
| P-04 | Kanji details show readings, components, memory aid, examples, available stroke art | `renderDetail`, `initStrokeOrder` | T-05 |
| P-05 | Vocabulary/grammar details show examples and related links | `renderVocabDetail`, `renderGrammarDetail` | T-06 |
| P-06 | Learned state, favorites, and notes survive reload when storage works | `toggle*`, note handlers, `save` | T-07 |
| P-07 | Review offers 3/5/10-question sessions, recall, due/mistake filters, feedback, and resume | `renderPractice`, shared player | Practice checks, browser suite, T-08 |
| P-08 | A plan covers target-level list entries and preserves missed material | `Course.buildCurriculum`, `renderCourseDay` | Course tests, T-09 |
| P-09 | Plan quizzes choose unlocked questions and grade shared SRS state | `Course.selectQuizItems`, `courseGrade` | Course tests, T-10 |
| P-10 | Progress shows content counts and rolling activity | `renderProgress`, `studyStatsHTML` | T-11 |
| P-11 | Export captures the main store; import replaces it after basic validation | Backup helpers | T-12 |
| P-12 | Settings supports theme, autoplay, plan changes, intro replay, confirmed erase | `renderSettings`, `applyTheme` | T-13 |
| P-13 | Desktop/mobile navigation, visible focus, reduced motion | Shell, CSS, stroke animator | T-14 |
| P-14 | Android uses packaged files, document pickers, and in-app Back handling | MainActivity, Platform, `KKBack` | T-15 |
| P-15 | Quick starts, real goal/week cards, mascot tips/feedback, dark theme, finite and reduced motion | `design.js`, player, CSS | Design browser suite, T-14 |
| P-16 | Explicit device reminder opt-in, goal/duplicate suppression, native closed-app delivery, web/calendar limits | Reminders, native reminder classes, worker | Reminder unit/browser/native tests, T-16 |

Learning is text-only. Daily challenges open finite discovery-card sessions: guess a shape, flip to reveal meaning/readings and memory cues, explicitly rate recall, then swipe or tap to advance. Cards share saved progress and SRS; pronunciation and listening features were removed on 2026-10-09.

Home shows distinct kanji, vocabulary, and grammar items studied/practiced today, new-study and attempt totals, and current-batch completion separately. Three daily challenges track the practice goal, a rotating subject, and three flipped-and-rated kanji. Wrong answers count as effort; repeats do not inflate distinct-item goals. Challenges and the daily word follow the local date, refreshing an open Home on the next clock/visibility check. Weekly activity, supportive return copy, achievements, and reminders complement the task list without penalties for missed days. See [discovery cards](discovery-cards.md).

## Behavior distinctions

All Review and plan quiz entry points use the shared practice player and grade SRS and activity. Smart sessions at the active plan level select unlocked or previously studied material; without a matching plan they sample the selected level. Due and mistake modes include studied records across all levels. Plan mode selects unlocked question items; distractors can come from other target-level records. Best raw scores remain for completed ten-question, single-kind multiple-choice sessions whose questions all match the selected level.

A learned flag means an item was marked learned or correctly answered or recalled in any practice session. It is separate from mastery classification, which also uses SRS box/due status. Completion percentages use learned flags.

Kanji lists overlap. Learning a character affects every occurrence. Vocabulary and grammar progress uses level-qualified record IDs.

## Quality properties and limits

| Property | Implemented basis | Limit |
| --- | --- | --- |
| Offline native operation | Packaged assets; no `INTERNET` permission | Build tools may need network downloads |
| Portable web delivery | Relative static paths; hash routes | Notification worker does not cache files; no offline reload guarantee |
| Local persistence | Main localStorage object and separate intro flag | Blocked/full storage displays an export-backup notice |
| Data consistency | Generated JSON and fallback bundle | Bundle must be refreshed after content changes |
| Accessibility support | Semantic controls, labels, focus, reduced motion | No conformance audit recorded |
| Testable scheduling | Pure logic, browser integration, and native reminder unit tests | Physical-device power management and pipeline end-to-end coverage remain separate |

The repository defines no performance SLA, uptime commitment, certified browser matrix, or cloud recovery service.

## Scope boundaries

Accounts, backend services, cloud sync, audio practice, a reading comprehension curriculum, and full-length JLPT mock exams are not implemented. Recall cards and due-only review are available through `#/practice`. Optional native reminders, open-page browser notifications, and calendar export are implemented; web closed-page push and offline caching are not. The mnemonic model hook is an extension point with no model integration shipped.

Exam choices are generated offline from a July/December first-Sunday rule. They are planning estimates, not a retrieved calendar of confirmed local sessions. Content counts are dated in the [root README](../README.md#content-snapshot); runtime totals should continue to come from data.

## Daily learning feature review

See [daily learning improvements](learning-improvements.md) for the delivered priorities, learning rationale, acceptance criteria, and next content track.

See [design and reminders](design-and-reminders.md) for the visual refresh, mascot, return flows, and reminder platform limits.
