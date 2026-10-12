# Product scope and requirements

Pengo supports Japanese learners preparing for JLPT N5–N1 with a reference library and daily study plan. It requires no account. Native Android carries the content on the device; web hosting serves the same static runtime.

## Primary journeys

1. Choose a level on Home, set an optional exam target and daily pace, and begin the first batch.
2. Search and explore all levels of kanji, words, and grammar. Within the study level, add notes/favorites and mark items learned; other levels are read-only.
3. Study the current plan batch and unfinished earlier material, then answer a mixed daily quiz.
4. Learn with cards or test a chosen type/level in Learn, inspect Progress, and export a backup before moving devices.
5. Choose an optional local reminder time; return directly to short practice from a notification.

The two-page intro combines the Pengo welcome and JLPT preparation pitch, then presents features and offers a guided tour of the real interface. It appears automatically on a first native launch, can be previewed on the web with `?onboarding=1`, and can be replayed through Settings.

## Implemented capability requirements

These documentation IDs organize acceptance checks; they are not historical issue identifiers. T identifiers refer to the [testing matrix](testing.md#manual-acceptance-matrix), whose procedures are not claims of completed manual testing.

| ID | Capability and current acceptance criterion | Implementation | Check |
| --- | --- | --- | --- |
| P-01 | Load N5–N1 content from local runtime files | `loadData`, `loadDataFetch` | T-01, T-02 |
| P-02 | Home shows a mascot welcome, a level picker without a plan, daily learning and progress status | `renderHome`, `renderAdventureHome` | T-03, design browser suite |
| P-03 | Browse by level with search, learned/favorite filters, sorting | Three browse renderers, `bindBrowseSearch` | T-04 |
| P-04 | Kanji details show readings, components, memory aid, examples, available stroke art | `renderDetail`, `initStrokeOrder` | T-05 |
| P-05 | Vocabulary/grammar details show examples and related links | `renderVocabDetail`, `renderGrammarDetail` | T-06 |
| P-06 | Learned state, favorites, and notes survive reload when storage works | `toggle*`, note handlers, `save` | T-07 |
| P-07 | Learn offers learning cards, four one-tap quiz choices, due/mistake shortcuts, feedback, resume, and visual recent results | `renderPractice`, shared player | Practice checks, browser suite, T-08 |
| P-08 | A plan covers target-level list entries and preserves missed material | `Course.buildCurriculum`, `renderCourseDay` | Course tests, T-09 |
| P-09 | Plan quizzes choose unlocked questions and grade shared SRS state | `Course.selectQuizItems`, `courseGrade` | Course tests, T-10 |
| P-10 | Progress shows content counts and rolling activity | `renderProgress`, `studyStatsHTML` | T-11 |
| P-11 | Export captures the main store; import replaces it after basic validation | Backup helpers | T-12 |
| P-12 | Settings supports theme, autoplay, plan changes, intro replay, confirmed erase | `renderSettings`, `applyTheme` | T-13 |
| P-13 | Desktop/mobile navigation, visible focus, reduced motion | Shell, CSS, stroke animator | T-14 |
| P-14 | Android uses packaged files, document pickers, and in-app Back handling | MainActivity, Platform, `KKBack` | T-15 |
| P-15 | Quick starts, real goal/week cards, mascot feedback, dark theme, finite and reduced motion | `design.js`, player, CSS | Design browser suite, T-14 |
| P-16 | Explicit device reminder opt-in, goal/duplicate suppression, native closed-app delivery, web/calendar limits | Reminders, native reminder classes, worker | Reminder unit/browser/native tests, T-16 |

Learning is text-only. The daily flashcard entry opens or resumes learning immediately. Decks use remaining current-batch items with a plan, or the remaining daily practice goal without one, up to ten cards. After completion, learners can choose another deck. Incomplete challenges open random flashcards for exactly the remaining distinct-item target, in decks of at most ten. Completed challenges display status. A challenge temporarily parks an unfinished daily deck and restores it on completion. Cards reveal meaning, Japanese 音読み/訓読み labels, memory cues and examples with available furigana. “Got it” advances directly; “Still learning” retains its feedback and Next/swipe action. “Got it” marks an item studied and initializes its first review if needed; neither confidence choice grades SRS, creates/clears quiz mistakes, nor changes test attempts/accuracy. Cards and quizzes keep independent saved sessions; pronunciation and listening features were removed on 2026-10-09.

Home shows distinct kanji, vocabulary, and grammar items studied/practiced today. Its connected subject-list rows and View items link open `#/today`, a deduplicated daily list with subject filters and links to item details. Three daily challenges track the practice goal, a rotating subject, and three flipped-and-rated kanji. Wrong answers count as effort; repeats do not inflate distinct-item goals. Challenges and the daily word follow the local date, refreshing an open Home on the next clock/visibility check. Home’s hero starts or continues learning, including after goal completion. Weekly activity, the daily practice card, achievements and learning milestones live in Progress. Home omits the separate flashcards, playground and daily-practice cards. The greeting mascot is static and Pengo tips are removed; reminder suggestions disappear when enabled or dismissed, with dismissal stored on the device. See [discovery cards](discovery-cards.md).

## Behavior distinctions

Learn has three compact subject cards in one row, followed by all-subjects, kanji, vocabulary and grammar quiz buttons. One tap starts up to five smart questions; no custom quiz form is needed. Existing explicit 3/5/10-question links remain compatible. Saved quizzes can continue or be replaced after choosing a new subject, without clearing previously graded progress. Recent quizzes displays the last ten quiz results using score rings, subject, level and date; many subsequent learning decks do not erase those results. Learn omits the introductory text, daily-practice card and redundant plan-level badge.

All Learn and plan quiz entry points use the shared practice player and grade SRS and activity. Smart sessions at the active plan level select unlocked or previously studied material; without a matching plan they sample the selected level. Due and mistake modes use the chosen plan level, or all levels when no plan is active. Plan mode selects unlocked question items; distractors can come from other target-level records. Completion messages and mascots reflect the score, with supportive book-holding Pengo below 50% and celebrations from 80%. Best raw scores remain for completed ten-question, single-kind multiple-choice sessions whose questions all match the selected level.

A learned flag means an item was marked learned correctly answered in a quiz, or marked “Got it” on a learning card. It is separate from mastery classification, which also uses SRS box/due status. Completion percentages use learned flags.

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

Accounts, backend services, cloud sync, audio practice, a reading comprehension curriculum, and full-length JLPT mock exams are not implemented. Learning cards use `#/flashcards`; one-tap quiz choices and due/mistake reviews live in `#/learn?section=quiz`. There is no standalone Review page or tab; old Review/practice bookmarks redirect to the appropriate current route. Optional native reminders, open-page browser notifications, and calendar export are implemented; web closed-page push and offline caching are not. The mnemonic model hook is an extension point with no model integration shipped.

Exam choices are generated offline from a July/December first-Sunday rule. They are planning estimates, not a retrieved calendar of confirmed local sessions. Content counts are dated in the [root README](../README.md#content-snapshot); runtime totals should continue to come from data.

## Daily learning feature review

See [daily learning improvements](learning-improvements.md) for the delivered priorities, learning rationale, acceptance criteria, and next content track.

See [design and reminders](design-and-reminders.md) for the visual refresh, mascot, return flows, and reminder platform limits.

Global Search is a vocabulary dictionary across all five levels, matching Japanese spelling/readings and English meanings only, with “Search any word” placeholders; Learn searches stay at the chosen study level. Related kanji/components/vocabulary/grammar remain accessible regardless of level. Outside-plan details have no learned, favorite, note or quiz actions, and viewing/revealing them does not affect the syllabus or progress. Back buttons return to the originating page, including related details and saved search queries. Today’s word is an animated, tappable discovery immediately below the Home hero.

Native first launch offers an interactive tutorial after the welcome screens. Learners follow highlighted controls through a flashcard preview, today’s word, today’s studied items, daily challenges, a quiz preview, and Progress. The tutorial can be skipped and replayed with Settings → Replay intro. Preview ratings/answers preserve learned state, saved sessions, SRS, results, and activity. New learners continue to study-plan setup after completion; replay returns to Settings. See [frontend](frontend.md#interactive-introduction).
