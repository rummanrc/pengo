# Interface reference

Pengo has no HTTP application API. Its interfaces are classic JavaScript bindings, file contracts, and a native JavaScript bridge. Content/storage shapes are in [data model](data-model.md); routes are in [frontend](frontend.md).

## Course API

`course.js` creates browser global `Course` and assigns `module.exports = Course` when CommonJS is available. It has no DOM/storage dependency. Use ES5-compatible syntax for compatibility with the existing dukpy harness. Functions expect valid caller-supplied shapes unless their documented defaults apply.

### Constants

| Export | Value/meaning |
| --- | --- |
| `LEVELS` | N5, N4, N3, N2, N1 |
| `LEVEL_NAMES` | Human-readable level names |
| `DEFAULT_WEIGHTS` | `{ kanji: 3, vocab: 5, grammar: 2 }` |
| `DEFAULT_DAILY_NEW` | 20 |
| `MILESTONES` | Nine `{ id, label }` entries |
| `EXAM_MONTHS` | July/December, zero-based months 6/11 |
| `GRAMMAR_FREQ_ORDER` | Core Grammar, Common, JLPT-Focused, Literary |

Constants are mutable objects/arrays; there is no freeze or supported live configuration UI for all of them.

### Dates, schedule, and ordering

| Signature | Return/behavior |
| --- | --- |
| `todayStr(nowMs?)` | Local `YYYY-MM-DD`; optional epoch ms |
| `toDayStr(date)` | Local date string |
| `parseDay(dayString)` | Local-midnight Date; not strict date validation |
| `diffDays(a, b)` | Rounded day difference, b minus a |
| `addDays(day, n)` | Date string after adding n fixed 24-hour periods |
| `firstSunday(year, monthIndex)` | Day-of-month number |
| `upcomingExams(today, count?)` | Ordered `{ id, label, date }[]`, default four; bounded three-year search |
| `daysUntil(examDate, today)` | Day difference, or null for empty exam date |
| `dayPart(hour)` | `morning`, `afternoon`, `evening` |
| `dayIndex(startDate, today)` | Calendar day index, minimum one; current unlocking does not use it |
| `scheduleStatus(curriculumDaysLeft, calendarDaysLeft)` | `{ state, behind }`; done/no-date/passed/on-track/behind |
| `sortKanji(records)` | New frequency-ordered array; missing/nonpositive ranks last |
| `avgKanjiFreq(text, frequencyMap)` | Average available finite character rank or null |
| `median(numbers)` | Numeric median or Infinity if empty |
| `sortVocab(records, frequencyMap, fallbackFrequency?)` | New average-rank ordered array, then shorter word, then input order |
| `grammarFreqRank(record)` | Known category index; unknown ranks last |
| `sortGrammar(records)` | New category-ordered array; stable ties |

### Curriculum and pace

| Signature | Return/behavior |
| --- | --- |
| `normalizeWeights(weights?)` | Positive per-type weights, invalid/missing values use defaults |
| `splitDaily(dailyNew, weights?)` | `{ kanji, vocab, grammar }` integer allocation |
| `suggestPace(counts, daysLeft, weights?)` | `{ total, daysLeft, recommended, relaxed, intensive }` |
| `buildCurriculum(lists, dailyNew, weights?)` | `{ kanji: ID[], vocab: ID[], grammar: ID[] }[]` day buckets |
| `unlockedForDay(curriculum, dayIndex)` | `{ kanji, vocab, grammar, all, total }`; `all` includes `{ type, id, day }` |
| `defaultCourse(target)` | Default plan with local start date; invalid target defaults N3 |

`lists` and `counts` use the three content type keys. See [course](course.md) for allocation, recommendation caps, and tail-day behavior.

### Quiz and progress

| Signature | Return/behavior |
| --- | --- |
| `classifyItem({ isLearned, inSrs, box, isDue })` | new/weak/learning/mastered |
| `itemWeight(state)` | new 5, weak 4, learning 2, mastered 0.5; unknown 1 |
| `selectQuizItems(items, stateOf, count?, rand?)` | Unique selected item array; default ten and Math.random |
| `recordStudyDay(days, date)` | Sorted deduplicated copy with date included |
| `calcStreak(days, today)` | Consecutive study-day count ending today or yesterday |
| `levelProgress(total, learned)` | `{ total, learned, left, pct }`; empty total gives 100% |
| `courseStats(unlocked, isLearned)` | Per-type stats and `overall` |
| `courseCompletion(lists, isLearned)` | Full-level progress shape |
| `todayWorkload(newCount, reviewCount)` | `{ isNew, review, total }`, nonnegative counts |
| `milestoneEarned(id, stats)` | Boolean threshold result |
| `checkMilestones(stats, already)` | Newly earned milestone IDs |
| `milestoneLabel(id)` | Label or unchanged unknown ID |

`stateOf(item)` returns a classification string. `isLearned(type, id)` returns truthiness. `rand()` should return a value in [0, 1); injecting it makes sampling checks deterministic. Milestone stats keys are `studyDays`, `streak`, `vocabLearned`, `kanjiLearned`, `perfectQuiz`, and `coursePct`.

## Practice interfaces

`practice.js` exposes the browser global/CommonJS `Practice`. `config(query, fallbackLevel)` normalizes session choices. `select(pool, config, srsOf, mistakes, stateOf, random?)` returns unique bounded item references; due mode sorts oldest first, smart/plan mixed sessions cover available skills. `nextReview(previous, correct, nowMs, localDate)` returns a new SRS record with one successful promotion per day. `validSession(session, exists)` checks persisted references, options, cursor, configuration, and answer shapes. `normalize(value)` supplies practice containers and bounds history to 60 entries, protecting the latest ten quizzes even after many recall decks. `stats(days, today, dailyGoal)` derives actual-practice goals, week activity, break days, attempts, and streak; `earned(stats, existingBadgeIds)` returns newly earned IDs. `count(day)`, `key(item)`, `size(n)`, and `goal(n)` support these contracts. Constants are `TYPES` and `BADGES`.

`practice-ui.js` uses app globals to expose `renderPractice`, `renderPracticePlayer`, `startPractice`, `finishPractice`, and daily dashboard/settings helpers. Runtime calls happen only after app data/store initialization; the UI script itself performs no startup work.

## Design and reminder interfaces

`design.js` supplies `renderAdventureHome`, `dailyPracticeCardHTML`, `bindPengoUI`, and mascot/icon/result helpers using initialized app globals. It is presentation code rather than a separate progress store.

`reminders.js` exposes the classic global/CommonJS `Reminders`. Pure helpers are `normalize(value)`, `dateKey(date)`, `shouldDeliver(value, now, goalMet)`, and `calendar(time, now?)`. Device operations are `read()`, `permission()`, async `enable(time)`, `disable()`, `resetDevice()`, and `syncGoal()`. Native enable returns `{ pending: true }`; permission/configuration results arrive at `window.PengoReminderResult(ok, message)`. Browser enable resolves `{ ok, message }`, requests permission on explicit action, and registers the worker before saving enabled state. `init()` synchronizes native goals or starts one browser timer/listener; `tick(now?)` checks opt-in, time, goal, and duplicates before notification display.

`reminderSettingsHTML` and `bindReminderSettings` own the Settings controls. `reminder-worker.js` handles notification taps within its deployment scope; it neither caches nor schedules content. Storage and practical limits are in [design and reminders](design-and-reminders.md).

## Platform and browser hooks

`Platform` and `APP_VERSION` are explicitly on `window`; `APP_VERSION` is currently `1.0.0`.

| Interface | Contract |
| --- | --- |
| `Platform.version` | App version string |
| `Platform.isNative` | Presence of `PengoNative` at initialization |
| `Platform.isCapacitor` | Capacitor native-platform detection at initialization |
| `Platform.nativePlatform` | `ios` from the iOS bridge, `android` for the legacy Java bridge, Capacitor's platform, or `web` |
| `Platform.isNativeApp` | Getter combining native/Capacitor flags; controls native first-launch onboarding |
| `Platform.isAndroidApp` / `Platform.isIOSApp` | Platform-specific getters |
| `Platform.backingStoreNote()` | Device/browser storage explanation |
| `Platform.exportJson(filename, text)` | Async: native bridge, then share if supported, otherwise Blob download; returns true when dispatched |
| `Platform.receiveImport(text)` | Calls `window.importBackupText` if available; does not itself parse JSON |
| `Platform.setDarkTheme(dark)` | Forwards Boolean to native system bars when bridge exists |
| `Platform.handleBackPress()` | History Back and true off Home, false on Home |
| `window.KKBack()` | Tries `OBBack` then Platform Back; native entry point |
| `window.OBBack()` | Intro Back handler while overlay exists; null after finish |
| `importBackupText(text)` | Global function: basic validation, replacement, normalize/save/theme/render; Boolean result |
| `window.KKDiag.stroke` | Last stroke loader fetch/XHR/script/length diagnostic |

Native bridge detection occurs during script initialization; late bridge injection would need reevaluation. Native export resolves dispatch, not successful document writing. Web share errors fall through to download.

## Native Java bridge

The Java activity installs `NativeBridge` through `addJavascriptInterface(..., "PengoNative")` before navigation.

| Method | JavaScript arguments/result | Native behavior |
| --- | --- | --- |
| `getVersion()` | Returns string | `BuildConfig.VERSION_NAME` |
| `exportJson(filename, text)` | Two strings; void | Opens JSON create-document picker; saves UTF-8 after selection |
| `importJson()` | No arguments; void | Opens document picker accepting JSON/text MIME suggestions |
| `showMessage(message)` | String; void | Android Toast on UI thread |
| `setDarkTheme(dark)` | Boolean; void | Changes status/navigation bar colors/flags |
| `getReminderSettings()` | Returns JSON string | `enabled`, `time`, effective `permission`, `nextAt` |
| `setReminder(enabled, time)` | Boolean, `HH:MM`; void | Validates, requests permission only for opt-in if needed, schedules/cancels; result callback |
| `setReminderGoalDate(date)` | Local `YYYY-MM-DD` or empty; void | Suppresses today's daily alert when goal is complete |
| `resetReminderSettings()` | No arguments; void | Cancels alarm, resets off/19:00 and delivery/goal dates; preserves OS permission history |
| `openNotificationSettings()` | No arguments; void | Opens system notification settings, or app details on API 24–25 |
| `sendTestReminder()` | No arguments; void | Explicit permission-checked test; does not consume daily alert; result callback |

Request codes are 4101 for export and 4102 for import. Canceling clears pending export text. Import reads the whole file, quotes it with `JSONObject.quote`, and evaluates `window.Platform && window.Platform.receiveImport(...)`. Read/write errors show native messages. There is no import-size limit or export queue.

Notification permission uses request code 4103. Results invoke `window.PengoReminderResult` with a quoted message. Denial does not enable a new reminder; turning off while a permission request is pending prevents a later grant from scheduling it. Alarm and restore receivers operate without the WebView. A notification launches short practice on cold startup or calls `go()` on the existing activity.

## Native iOS bridge

`ios/Pengo/bridge.js` is injected before page scripts in the main frame. It supplies the same `PengoNative` method names plus `getPlatform()` returning `ios`. Calls post structured messages to `WebViewController`; only the bundled `pengo://app` main frame can invoke native methods. Import/export uses Files pickers, `showMessage` uses an alert, and theme changes update the status bar/background. The shell implements JavaScript alert/confirm dialogs.

`getReminderSettings()` synchronously serializes a cache with `enabled`, `time`, `lastDate`, and `permission`. Native permission refresh/configuration publishes that cache through `PengoIOSUpdateReminders`, then invokes the existing `PengoReminderResult` callback. iOS notifications use a rolling 60-day plan refreshed on activation, with today's known goal omitted. See [iOS setup and acceptance](ios.md) for limitations and device checks.

## Mnemonic extension

`KanjiMnemonic.generate({ kanji, meaning, parts, on, kun })` returns `{ text, notice }` using deterministic templates. `generateSmart(input, fallback)` can invoke an assigned async `generateViaModel(input)` and fall back if it throws. `mnemonicFor(item)` currently prefers prebuilt text and otherwise invokes the local generator; normal detail rendering does not call `generateSmart`.

The hook is unconnected scaffolding. A model feature would require explicit wiring, credentials/network design, privacy review, and offline fallback; assigning the hook alone does not change current details.

## Discovery cards and components

`renderRecallPlayer(view, session)` renders the recall deck; confidence choices record `day.recalled` and `day.practiced` once, and “Got it” calls `courseMarkStudied`. They do not call `courseGrade` or change quiz accuracy/mistakes. Swipe/ArrowRight advances after a confidence choice. `revealedCursor` and validated `deck` detail links restore the same revealed card. `renderPractice(view, query, playerView?)` renders one-tap subject choices inside Learn and starts/resumes the quiz in the main view; the default is up to five smart questions. `recentQuizzesHTML(history)` renders the latest ten quiz summaries as accessible score rings, excluding recall. Inactive route/player handlers cannot grade a newer session. `learningComponents(item)` returns larger KanjiVG chunks with KRADFILE fallback. `storyComponents(item)` returns explicit matching mnemonic references, falling back to the original components for existing stories. `componentsHTML(item)` renders story cues, expandable structural levels and the optional smallest-part comparison. These functions run only after app globals initialize. `KK_COMPONENTS` is classic-script content and works offline.

## Daily challenge learning

`Dashboard.challenges(days, today, goal, level)` exposes `kind`, `remaining` and a challenge route for each daily target. `Dashboard.challengeItems(pool, quest, day)` deduplicates item references, applies the subject filter, and excludes keys already counted in `practiced` (daily/focus) or `recalled` (kanji flips). `startChallengePractice` recomputes the target from current state, samples at most ten random remaining items, and preserves normal learning in `practice.returnSession` while keeping any quiz in its existing format slot. Completed and expired challenges restore the validated parked session. `recallDetailsHTML` delegates to the shared `quizReviewHTML` recap for every subject. `Reminders.nudgeDismissed()` and `dismissNudge()` manage the device-local Home prompt preference without changing notification settings.

## Guided introduction

`showOnboarding(onDone)` calls `onDone(true)` to begin the interactive tutorial, or `onDone(false)` after welcome skip. `OnboardingTour.start({replay})` begins a guided tour against loaded data; replay remembers and restores the Settings route. `OnboardingTour.refresh()` updates the current highlight after rendering, scrolling, or viewport changes. `showPreview(view, cfg)` and `isPreview(session)` connect the existing players to ephemeral preview sessions. Preview answers/ratings bypass persistence and grading; `finishPractice` rejects preview completion. `OBBack` exits the tour safely before ordinary native Back handling. `introTour=1` marks temporary navigation and is dropped on reload when no tour is active. These helpers are UI integration APIs; the tour flag and preview sessions are not part of backups.
