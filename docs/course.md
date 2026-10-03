# Pengo study plan (course) architecture

The study plan is a course layer on top of the existing dictionary/reference
app. It never duplicates content: kanji, vocabulary and grammar records stay
the single source of truth, and the plan only stores references plus settings.

## Files

- `course.js` - pure scheduling logic, no DOM. Browser global `Course`
  (also `module.exports` for tooling). ES5 style so it runs in the WebView
  and under the dukpy test runner. Loaded before `app.js` in `index.html`
  and shipped offline via `scripts/sync_www.py`.
- `app.js` - "Course:" section: persistence helpers, `#/course*` views,
  home banner, settings card. Reuses `progressBar`, quiz option styling,
  `srsGrade`/`vSrsGrade`/`gSrsGrade`, and the existing detail routes.
- `styles.css` - small `.course-item` / `.mile` / `.exam-row` additions.
- `tests/test_course.py` - 78 assertions executed against the real
  `course.js` (`pip install dukpy && python tests/test_course.py`).

## Data model

Learning item: `{ type: "kanji" | "vocab" | "grammar", id: id }`.

- kanji id = the character itself (`DB.byChar` key)
- vocab id = vocab record id, e.g. `N5-1198180-0` (`DB.vById` key)
- grammar id = grammar record id, e.g. `N5-001` (`DB.gById` key)

`store.course` (inside the existing `knowkanji:v1` localStorage value, so
export/import backup keeps working):

- `target` - JLPT level, `examId`/`examLabel`/`examDate` (`""` = no date)
- `startDate` - `YYYY-MM-DD`, day 1 of the plan
- `dailyNew` - new items per day, `weights` - `{ kanji, vocab, grammar }`
- `studyDays` - sorted `YYYY-MM-DD` list, `milestones` - earned ids
- `quizzes`, `perfectQuiz` - quiz history counters

Learned/SRS state is shared with the rest of the app (`store.learned`,
`store.srs`, `store.vLearned`, `store.vSrs`, `store.gLearned`, `store.gSrs`),
so marking items studied in a plan also updates Progress/Review, and vice
versa. Changing the target starts a fresh curriculum (study-day history is
kept, milestones reset); ending a plan keeps all learned items and reviews.

## Curriculum generation

`Course.buildCurriculum(lists, dailyNew, weights)` walks the level lists in
frequency order (kanji by KANJIDIC frequency number; vocabulary by the
average frequency of the word's kanji with kana-only words at the level
median; grammar by category Core Grammar, Common, JLPT-Focused, Literary;
all stable so ties keep dataset order) and fills day buckets with `Course.splitDaily` counts
(largest-remainder split of `dailyNew` by `weights`, minimum 1 per type when
the pace allows). Default weights `{ kanji: 3, vocab: 5, grammar: 2 }`
prioritise vocabulary while introducing kanji and grammar every day. Every
content id appears exactly once; the tail day takes whatever is left, so a
starved type still finishes once the others are exhausted. The curriculum is
derived on the fly from `DB`, never stored, so content updates apply
automatically.

## Daily pool (progress-based unlocking)

The plan tracks `store.course.unlockedDay` (starts at 1) instead of the
calendar date, so missing a day never skips material: the current batch
stays until studied. `Course.unlockedForDay(curriculum, unlockedDay)`
returns everything unlocked so far. The day view shows the current batch
(tap through to the existing detail pages, then "Mark studied"), a backlog
of unstudied items from earlier batches, and the unlocked items whose SRS
review is due. A finished batch offers "Continue to day N+1"; an "Unlock
day N+1 early" button lets eager users pull extra batches any day.
Schedule pressure is informational only: `Course.scheduleStatus`
compares curriculum days left against calendar days until the exam and
reports on-track / behind-by-N / no-date / passed, never blocking study.

## Daily quiz selection

`Course.selectQuizItems(unlocked, stateOf, count)` samples without
replacement: up to 3 newly introduced items are always included, the rest is
weighted (`new` 5 > `weak` 4 > `learning` 2 > `mastered` 0.5), so weak/due
items surface first while mastered ones still revisit occasionally. Only
unlocked items can be picked. Answers feed the existing SRS graders, so the
plan and Review stay in sync.

## Streak logic

`Course.recordStudyDay` keeps one entry per local calendar day (multiple
sessions collapse). `Course.calcStreak` counts back consecutive days; a rest
day yesterday keeps today eligible, a missed day restarts at the next study
day. Tone stays encouraging, never threatening.

## Persistence

Everything lives in the existing store object under `store.course`; `save()`
is reused unchanged. No new storage keys, no network, offline-first.

## Exam-date handling

No fixed dates ship with the app. `Course.upcomingExams(today)` generates
the next sessions from the usual first-Sunday-of-July/December rhythm
(`Course.EXAM_MONTHS` is the one place to edit if the schedule changes).
"No specific exam date" is always available; with no date the pace
suggestion assumes a 90-day horizon. `Course.daysUntil` returns `null`
without a date and negative values after a passed exam (shown as passed,
never blocking).

## Review scheduler

`planned new items + items due for review = today`s workload`
(`Course.todayWorkload`). Due reviews reuse the existing SRS boxes; a wrong
quiz answer resets to box 0 (10-minute retry), a right answer steps the box
up the shared `SRS_STEPS` ladder. Future adaptive pacing (fewer new items
when many are due) can build on `todayWorkload` without touching quiz code.

## How to add/update JLPT content

Unchanged: replace files under `resources/` and run `scripts/build_data.py`,
`scripts/build_vocab.py`, `scripts/build_grammar.py`, then
`python scripts/build_bundle.py`. The plan picks new content up
automatically because the curriculum is derived from `DB` at render time.

## External dataset sources and licenses

No new datasets. Same sources as the app: KANJIDIC2, KRADFILE (EDRDG),
KanjiVG, Tanaka Corpus, Kanjium, JLPT vocab lists, Tatoeba sentences, Anki
grammar deck (text only). See `resources/CREDITS.md`.

## Routes (Home is the dashboard)

- `#/` - level-picker splash (`N1 Advanced` .. `N5 Beginner`) when no plan
  exists; otherwise the course dashboard: greeting, Continue Learning card
  (current batch progress), Kanji/Vocab/Grammar/Review tiles into the
  existing Learn/Review pages, Today's Goal (studied today vs daily pace),
  streak + schedule line, milestones. There is no separate course page.
- `#/course/setup` - planning wizard: level (accepts `?target=N4` from the
  splash), exam date, pace
- `#/course/day` - today`s new items + due reviews + quiz entry
- `#/course/quiz` - 10-question mixed quiz over the unlocked pool
- `#/course/reset` - end plan (confirm; learned items and reviews kept);
  after ending, Home returns to the splash picker
