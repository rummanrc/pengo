# Frontend reference

## Shell and rendering

`index.html` contains `.app`, `.sidebar`, `#sideNav`, `.topbar`, `#topSearch`, `#view`, `#creditsFooter`, and `#bottomNav`. `initChrome()` wires theme buttons and quick search. Credits are shown on Settings. Mobile navigation omits the Search tab; quick search is in the mobile topbar.

`render()` parses the hash, dispatches a renderer, marks navigation, focuses the main view with `preventScroll`, and scrolls to the top. Most views replace `#view.innerHTML` and then attach handlers. Unknown routes fall back to Home. Missing detail IDs show their renderer's empty/error state.

`go(hash)` rerenders when the hash is unchanged, otherwise lets `hashchange` trigger rendering. `parseHash()` uses `decodeURIComponent` on segments/query pairs; malformed percent encodings are not broadly guarded. Encode IDs/query text with `encodeURIComponent` when generating links. Query parsing decodes percent escapes and form-encoded spaces so searches restore after navigation/reload.

## Route contract

| Hash route | Behavior | Owner |
| --- | --- | --- |
| `#/` | Adventure welcome, optional level picker, daily flashcards and progress status | `renderHome`, `renderAdventureHome` |
| `#/learn?lv=N4` | Three subject cards in one row, learning entry, one-tap quiz choices and visual history | `renderLearn` |
| `#/kanji` or `#/kanji/N5` | Kanji browser; invalid/missing level defaults to N5 | `renderBrowse` |
| `#/kanji/<character>` | Detail if character exists in global index | Router, `renderDetail` |
| `#/k/<character>` | Canonical kanji detail link | `renderDetail` |
| `#/vocab` | Vocabulary level overview | `renderVocabHome` |
| `#/vocab/N5` | Vocabulary browser | `renderVocabBrowse` |
| `#/v/<id>` | Vocabulary detail | `renderVocabDetail` |
| `#/grammar` | Grammar level overview | `renderGrammarHome` |
| `#/grammar/N5` | Grammar browser | `renderGrammarBrowse` |
| `#/g/<id>` | Grammar detail | `renderGrammarDetail` |
| `#/learn?section=quiz&kind=vocab&lv=N4` | Full quiz controls in Learn, scrolled to the assessment section | `renderLearn`, `renderPractice` |
| `#/learn?section=quiz&mode=due` | Due-only quiz setup; chosen plan level or all levels without a plan | `renderPractice` |
| `#/learn?section=quiz&mode=mistakes` | Targeted quiz mistakes | `renderPractice` |
| `#/learn?section=quiz&start=1&size=3` | Start/resume a quiz, preserving any learning deck | Shared quiz player |
| `#/learn?section=quiz&resume=1` | Resume the saved quiz | Shared quiz player |
| `#/flashcards` or `#/flashcards?daily=1` | Start/resume daily learning immediately, preserving a saved quiz | `renderFlashcards` |
| `#/flashcards?challenge=focus` | Random cards for the rotating subject challenge’s remaining target | `startChallengePractice` |
| `#/flashcards?choose=1` | Optional content/level/length chooser and saved-session controls after pausing | `renderFlashcards` |
| `#/today?kind=kanji` | Today’s distinct studied/practiced items, optionally filtered by subject | `renderTodayItems` |
| `#/flashcards?start=1&mode=explore&kind=kanji&size=3&lv=N5` | Reveal meaning/examples, advance directly with Got it, or use Next/swipe after Still learning | `renderRecallPlayer` |
| `#/k/<character>?deck=<saved-id>` (also `v` / `g`) | Details with return to the original learning card, including related details | `bindLearningCardReturn` |
| `#/review` or `#/practice` (with legacy parameters) | Replace current history entry with Learn quiz setup, or learning route for `format=recall` | Router |
| `#/search?q=tree` | Vocabulary dictionary search | `renderSearch` |
| `#/progress?level=N4&period=month` | Progress, selected hero level and rolling period | `renderProgress` |
| `#/settings` | Theme, autoplay, backup, erase, plan, about/intro | `renderSettings` |
| `#/settings?section=reminders` | Settings scrolled to opt-in reminder controls | Router, `bindReminderSettings` |
| `#/course` | Redirect to Home | `renderCourse` |
| `#/course/setup?target=N4` | Plan setup/change wizard | `renderCourseSetup` |
| `#/course/day` | Current batch, backlog, due links, quiz entry | `renderCourseDay` |
| `#/course/quiz` | Mixed quiz over unlocked question items | `renderCourseQuiz` |
| `#/course/reset` | Confirm ending the plan, then Home | `renderCourse` |
| `#/study?kind=grammar` | Legacy redirect into Learn quiz controls | Router |

Course day/quiz requires a plan; without one it redirects to setup. Unknown course subroutes redirect Home. Quiz content defaults to mixed; Learn defaults to the active plan target or N5. Progress derives a default hero level from plan/progress when no valid `level` is provided.

### Browse parameters

All three browser views support `q` (query), `f` (filter), and `s` (sort). Default filter is `all`; default sort is `freq`.

| Content | `f` values | `s` values |
| --- | --- | --- |
| Kanji | `all`, `learned`, `unlearned`, `fav` | `default`, `freq`, `strokes`, `alpha`, `progress` |
| Vocabulary | `all`, `learned`, `unlearned`, `fav`, `nosent` | `default`, `freq`, `alpha`, `reading`, `progress` |
| Grammar | `all`, `learned`, `unlearned`, `fav` | `default`, `freq`, `alpha`, `progress` |

`tab=quiz` still appears in some links but is ignored. Learning and quiz routes are separate; due/mistake modes are chosen in Learn quiz setup. Additional practice parameters are `mode=smart|due|mistakes|plan|explore`, `kind=mixed|kanji|vocab|grammar`, `size=3|5|10`, and `format=quiz|recall`. `explore` (Level sampler) draws from the chosen level; `plan` and plan-aware `smart` retain unlocked-material behavior. Progress uses `level`, while Learn/cards use `lv`.

## Search and details

`foldReading()` folds katakana to hiragana and removes reading separators/spaces. `foldEnglish()` lowercases and trims. Search uses local scans rather than a remote search service or a full dictionary index. Vocabulary matches spelling, reading, and English meanings only; examples and other metadata are excluded. Grammar browsing has its own matcher.

Browse search debounces at 150 ms, replaces results only, and updates hash state through `history.replaceState`; it must not destroy the focused input after each keystroke. Global Search debounces at 250 ms, scans vocabulary from all five levels, and preserves its query in the current history entry. It stops at 120 vocabulary results and excludes kanji and grammar records. Both global search inputs say “Search any word”; Learn browser placeholders name their chosen level.

Details link existing records from every level and navigate previous/next records. Kanji header badges show only JLPT; vocabulary headers omit JMdict IDs. Components show structural shapes with optional nested “Inside” and finer-part views. Mnemonic story cues appear as compact linked character/meaning pairs beside the story, with a plain-language reminder that the story is not the kanji’s origin. Source attribution and partial-breakdown labels remain. Within the active plan, they save notes after a 400 ms debounce and expose learned/favorite toggles; outside it, `applyDetailScope` removes mutation and quiz controls and shows a browse-only notice. Toggle helpers also guard level scope. Kanji details resolve the target-level record for overlapping characters when eligible, otherwise the global character index. Grammar translations use reveal controls; example links are derived from loaded content.

`esc()` escapes ordinary text and attributes. Furigana/grammar explanation HTML is inserted as markup; KanjiVG is parsed and inserted as SVG. These require trusted generated assets, as described in [security](security.md).

## Stroke diagrams

`initStrokeOrder()` loads `resources/stroke-order/kanjivg/<cp>.svg` through fetch, with XMLHttpRequest fallback. It finds stroke paths by ID containing `-s`, adds `.kvg-stroke`, and animates dash offsets. Stroke duration is 450 ms with 120 ms spacing; number visibility and replay are controls. Autoplay follows settings.

Reduced motion displays completed strokes/numbers immediately. Missing art disables playback; loading/parsing failures display diagnostics. The fallback data bundle contains JSON, not SVG bytes, so direct-file browser data success does not guarantee stroke-art access.

## Styling

`styles.css` owns theme tokens in `:root`, with dark overrides in `[data-theme="dark"]`. `applyTheme()` sets `document.documentElement.dataset.theme`, updates theme button icons, and forwards theme changes to native system bars.

| Area | Selectors/tokens to inspect |
| --- | --- |
| Palette/type/shape | `--bg`, `--card`, `--ink`, `--accent`, `--line`, `--shadow`, `--radius`, `--jp-font` |
| Shell/navigation | `.app`, `.sidebar`, `.topbar`, `.view`, `.bottom-nav` |
| Reference UI | `.kanji-grid`, `.kcard`, `.toolbar`, `.card`, `.btn`, `.badge` |
| Detail/examples | `.detail-*`, `.comp-*`, `.ex-*`, grammar styles |
| Progress | `.pg-*`, `.study-*` |
| Onboarding | `.ob-*`, `.ob-boot`, `.ob-open` |
| Plan/dashboard | `.course-item`, `.mile-*`, `.exam-row`, `.dash-*`, `.splash-*` |
| Daily practice | `.practice-*`, `.storage-notice` |
| Adventure Home | `.adventure-*`, `.hero-*`, `.trail-*`, `.discovery-*` |
| Goal and quiz choices | `.daily-quest`, `.quest-ring`, `.achievement-drawer`, `.quiz-picker`, `.quiz-choices` |
| Mascot/reminders | `.pengo-*`, `.practice-coach`, `.celebration-sparkles`, `.reminder-*` |
| Quiz/results | `.quiz-*`, `.correct`, `.wrong` |

The main navigation switch is at 860/861 px. Other rules handle narrow content, tablets/desktops, and short landscape screens. Safe-area insets protect mobile edges. Japanese fonts are system fallbacks; no web-font download is defined. Later rules override earlier sections, so inspect the cascade before appending duplicate selectors.

The adventure section supplies warm/teal theme overrides, matching dark colors, raised controls, and brief finite animations. Daily practice and milestones live in Progress. Learn omits introductory copy and the daily-practice card; its plan title replaces a redundant level chip. Three compact subject cards stay in one row at every viewport width, followed by four one-tap quiz choices: all subjects, kanji, vocabulary, grammar. Quizzes default to up to five smart questions. Completion feedback varies by score: perfect, at least 80%, at least 50%, and below 50%. Low scores show calm encouragement with the book-holding Pengo; only scores of at least 80% show celebration sparkles. Due/mistake shortcuts appear only when items exist. A saved quiz shows Continue and an optional new-quiz picker; opening or closing the picker keeps the saved quiz, while choosing a subject replaces it and preserves graded activity and learning sessions. The learning entry stays available. Recent quizzes show the latest ten results as accessible percentage rings, subject/level, raw score and date in a horizontally scrolling list. See [design and reminders](design-and-reminders.md) for the generated asset and notification behavior.

## Accessibility and lifecycle

Existing support includes a skip link, navigation labels/current state, semantic buttons, visible focus, Japanese `lang` attributes, progressbar values, and reduced-motion handling. Onboarding declares a modal dialog and supports swipe/back/skip. These features do not establish audited conformance: focus trapping/restoration and screen-reader behavior need manual review.

Timers include visible-time tracking (15 seconds), delayed notes/search, progress refresh, stroke animation, and browser reminder checks (30 seconds). The reminder permission callback checks whether its panel remains attached. `stopStrokeTimers()` exists, but rendering does not centrally cancel every asynchronous action. Rapid navigation can expose stale responses; account for lifecycle when changing asynchronous view code.

Vocabulary cards contain a `.vocab-card-link`. Voice controls/settings are removed. Discovery cards use two accessible faces; the inactive face is inert and hidden from assistive technology. Details/ratings stay hidden until reveal, and swipe/keyboard advance requires a prior rating. Reduced-motion users get an immediate flip. See [discovery cards](discovery-cards.md).

## Restored study plan and personal settings

`studyLevels`, `studyLevel`, and `inStudyLevel` in `app.js` centralize the active level. A plan takes priority over route level parameters, and Learn browsing/practice filter to that level. Global Search and related details span every level; outside-plan details are read-only. Without a plan, free level selection and reviews across levels remain available. `#/settings?section=plan` scrolls to the first Settings card.

The setup view uses `.plan-*` level and pace buttons with `aria-pressed`, a live summary, validated custom pace, and an optional exam date. Settings uses `.settings-*` cards, a simple Settings heading, a desktop two-column grid, and one column on mobile. Existing backup, theme, autoplay, intro and reminder actions keep their IDs. Erasure has its own card and retains inline confirmation/cancellation. The soft danger button explicitly defines theme-specific foreground/background colors.

Progress uses shared theme tokens for its page/card backgrounds, text, chart and borders. Its summary uses aligned SVG book/clock/calendar icons; mobile navigation icons also have identical containers in active/inactive states.

## Flashcard access fix — 2026-10-09

Home’s hero offers **Start learning / Continue learning / Learn more**. Learn retains its **Today’s flashcards** entry. The entry opens daily learning directly and resumes a saved deck before selecting more items. New decks use remaining current-batch items with a plan, or remaining daily-goal items without one, with at most ten cards. Once that target is met, Keep learning opens another deck of unstudied items, avoiding items already practiced today. Pause opens the optional `choose=1` hub. Switching quiz/cards preserves the other format in `practice.pausedSession`. The compact player uses two grid-overlapping faces with a 550ms Y-axis rotation, backface culling, tap/keyboard flip in both directions, inert inactive faces and an instant reduced-motion flip, an explicit meaning, Japanese 音読み/訓読み labels, and available example furigana. Got it advances immediately; Still learning retains feedback and manual advance. Incomplete daily challenges link to `#/flashcards?challenge=daily|focus|flip`; the renderer recomputes the remaining count and excludes items already counted today. Completed challenges are status only. A normal learning deck is retained in `practice.returnSession` while a challenge occupies the learning slot; completion or expiration restores it. All subjects use a single Quick recap card; kanji includes up to four larger shapes, its memory aid, two words and an annotated sentence. The connected daily subject-list rows link to `#/today`. Home has no Pengo tip, and its greeting mascot stays still even with normal motion. Reminder suggestions hide when enabled or dismissed. Learning milestones are on Progress.

Learning-card detail links carry a validated session ID rather than an arbitrary return URL. Back buttons follow app history through related details to the same cursor and revealed face; related details propagate this context. Validated deck context supplies a direct-open fallback. Before leaving the deck, its browser-history entry becomes the resumable card route so native/browser Back also returns correctly. Ordinary details and Learn browsers use actual Back buttons. App-owned history depth survives reload and query replacements; a direct open falls back to its browser or Learn rather than leaving the app.

Today’s word sits below the Home hero. A complete Pengo illustration gives three gentle bobs, then rests; clicking the invitation reveals the date-stable word, reading, meaning and detail link. Reveal/collapse never records learning. Reduced motion disables both the invitation and reveal animation.

## Interactive introduction

Native first launch keeps the two welcome screens, then offers **Try the guided tour**. `tutorial.js` highlights real controls and advances from the learner’s taps: Home’s learning button → flip and rate a preview card → Home → reveal today’s word → daily items → Home → a daily challenge → Learn → a quiz choice and preview answer → Progress. The word reveal and final progress explanation use Next/Finish buttons. Completed challenges get an explanation instead of a missing link.

The guide blocks unrelated taps and keeps keyboard focus among the highlighted control and guide buttons. Skip tour, Escape, and native Back exit safely. The guide sits beside content on short landscape screens, follows viewport changes, and uses no decorative motion. Practice previews live only in `OnboardingTour.previewSession`; ratings and answers do not change learned state, SRS, activity, results, or saved sessions. Intro/tour time is excluded from study time. Tour navigation replaces history entries, and stale `introTour=1` routes return Home after reload. Finishing a new intro without a study plan opens plan setup. **Replay intro** in Settings runs the same welcome and tour, then returns to Settings on finish/skip. The existing `pengo:onboarded:v1` flag remains compatible and is set when the intro is skipped or the tour exits.
