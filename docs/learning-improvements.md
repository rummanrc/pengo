# Daily learning improvements

Review and implementation: **2026-10-07 (Asia/Tokyo)**.

The existing app has a useful N5–N1 reference library, frequency-ordered study plans, and SRS. The main missed opportunity was the connection between opening the app, doing a manageable amount of practice, seeing progress, and returning later. Due badges led into randomly sampled quizzes; ordinary quiz answers did not grade SRS or count toward plan study days; sessions could not resume; the dashboard goal reflected new-material pace rather than review effort.

## Delivered feature list

| Priority | Feature | Result and acceptance criterion |
| --- | --- | --- |
| P0 | Short sessions | Choose 3, 5, or 10 questions. Home offers a three-question start. Mixed sessions cover each available skill before filling extra slots. Question counts can be smaller when the pool is small. |
| P0 | Due review | Due mode includes only existing SRS entries whose due time has arrived, oldest first, across all levels. Content filters are respected. Empty queues show a truthful completion state. |
| P0 | Mistake practice | Missed answers enter a persistent list. Successful recall clears the item. Session summaries link back to the material and offer targeted practice. |
| P0 | Active recall | Recall cards hide the answer until requested and then offer “Need practice” and “Remembered.” Ratings update SRS; summaries explicitly identify self-rated recall. |
| P0 | Resume after interruption | Save question references, options, cursor, and answers immediately. Reloading or leaving the route preserves feedback and never grades an answered question twice. Replacing a session requires an explicit choice. |
| P0 | Achievable daily goals | Settings offers 3, 5, 10, or 20 items; default 5. Wrong answers and newly studied items count. Each item counts once per local day. Review goals are independent of curriculum pace. |
| P0 | Supportive motivation | Show seven days of actual practice, an activity streak, five persistent achievements, and encouraging return copy after a break. Passive app time does not earn activity or goals. There are no penalties, competitive rankings, or endless automatic sessions. |
| P0 | Consistent feedback and progress | All quiz entry points share one player and grade SRS, learned flags, activity, and course study days. Summaries show results, progress, explanations, and “Done for now.” Same-day successful retries cannot repeatedly advance mastery or defer reviews. |

Additional fixes: excluded missing kanji records from due totals; made the due pill actionable; surfaced blocked storage; removed unsupported mock-test onboarding copy; labeled generated exam dates as planning estimates; retained grammar sentence-translation and fill-in-the-blank practice; filtered duplicate answer labels and obvious ambiguous distractors.

Implementation stays static and works with native packaging and the fallback bundle. No accounts or network-dependent runtime features were added. See [data model](data-model.md) and [course](course.md) for persistence and scheduling contracts.

## Learning rationale

Spacing and retrieval practice have evidence behind them; the design favors those mechanisms over additional rewards for tapping. [Cepeda et al., distributed practice in verbal recall](https://pubmed.ncbi.nlm.nih.gov/16719566/) and [Karpicke, retrieval practice](https://pubmed.ncbi.nlm.nih.gov/33006925/) support these learning principles. They do not establish that a three-question session or this interface improves JLPT outcomes. Session lengths and motivational copy are product hypotheses to evaluate with learners. A blanket claim that a generation has a shorter attention span is not needed to justify making interrupted study easier.

## Next content track

These are separate follow-up projects, not shipped capabilities or simulated exams:

1. **Reading comprehension:** licensed level-appropriate passages, questions, furigana controls, and explanations. Existing isolated examples do not constitute a comprehension curriculum.
2. **Listening practice:** licensed Japanese recordings, transcripts, comprehension questions, speed/replay controls, and offline asset packaging. Text-to-speech alone would not establish exam readiness.
3. **Exam-format practice:** representative item types and timed sections, followed by full mock exams with validated content and clear score limitations. The app’s learned percentage is not a JLPT pass prediction.
4. **Learner validation:** observe first practice, returning after a break, resume behavior, and finding explanations. Compare first-session completion, practice on distinct days, and delayed recall; evaluate these locally or through a separately agreed research approach.

The [official JLPT test composition](https://www.jlpt.jp/e/guideline/testsections.html) includes language knowledge, reading, and listening. Shipping credible exam preparation in those areas requires content work beyond the current library. The subsequent [design and reminders](design-and-reminders.md) implementation delivers the visual refresh and native/browser/calendar return flows. Hosted offline caching remains separate work.

## Verification

Run `npm test` for course, practice, and reminder/worker checks. The optional [browser suite](testing.md#practice-browser-integration) exercises real persistence, reload/resume, answers, due filters, goals, grammar question types, legacy backups, layout, blocked storage, and the fallback bundle. Subsequent [design/reminder verification](design-and-reminders.md#validation-and-practical-limits) adds native reminder tests and a debug APK build. Physical-device checks and real learner studies remain separate.
