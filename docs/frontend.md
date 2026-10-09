# Frontend reference

## Shell and rendering

`index.html` contains `.app`, `.sidebar`, `#sideNav`, `.topbar`, `#topSearch`, `#view`, `#creditsFooter`, and `#bottomNav`. `initChrome()` wires theme buttons and quick search. Credits are shown on Settings. Mobile navigation omits the Search tab; quick search is in the mobile topbar.

`render()` parses the hash, dispatches a renderer, marks navigation, focuses the main view with `preventScroll`, and scrolls to the top. Most views replace `#view.innerHTML` and then attach handlers. Unknown routes fall back to Home. Missing detail IDs show their renderer's empty/error state.

`go(hash)` rerenders when the hash is unchanged, otherwise lets `hashchange` trigger rendering. `parseHash()` uses `decodeURIComponent` on segments/query pairs; malformed percent encodings are not broadly guarded. Encode IDs/query text with `encodeURIComponent` when generating links. Query parsing is simple splitting, not full URLSearchParams form decoding.

## Route contract

| Hash route | Behavior | Owner |
| --- | --- | --- |
| `#/` | Adventure welcome, optional level picker, daily flashcards and progress status | `renderHome`, `renderAdventureHome` |
| `#/learn?lv=N4` | Three subject tiles, learning-card entry and full quiz controls for a level | `renderLearn` |
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
| `#/flashcards?choose=1` | Optional content/level/length chooser and saved-session controls after pausing | `renderFlashcards` |
| `#/today?kind=kanji` | Today’s distinct studied/practiced items, optionally filtered by subject | `renderTodayItems` |
| `#/flashcards?start=1&mode=explore&kind=kanji&size=3&lv=N5` | Reveal meaning/examples, advance directly with Got it, or use Next/swipe after Still learning | `renderRecallPlayer` |
| `#/k/<character>?deck=<saved-id>` (also `v` / `g`) | Details with return to the original learning card, including related details | `bindLearningCardReturn` |
| `#/review` or `#/practice` (with legacy parameters) | Replace current history entry with Learn quiz setup, or learning route for `format=recall` | Router |
| `#/search?q=tree` | Combined reference search | `renderSearch` |
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

`foldReading()` folds katakana to hiragana and removes reading separators/spaces. `foldEnglish()` lowercases and trims. Search uses local scans rather than a remote search service or a full dictionary index. Vocabulary/grammar matchers additionally inspect their relevant record text.

Browse search debounces at 150 ms, replaces results only, and updates hash state through `history.replaceState`; it must not destroy the focused input after each keystroke. Combined Search debounces at 250 ms. Vocab/grammar results stop at 120; the kanji loop's outer level loop can continue after the inner threshold, so the limit is imperfect (see [maintenance](maintenance.md)).

Details link existing records, save notes after a 400 ms debounce, expose learned/favorite toggles, and navigate previous/next records. Kanji record selection uses the global character index, so overlapping level entries can resolve to a later-level record. Grammar translations use reveal controls; example links are derived from loaded content.

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
| Goal and quick starts | `.daily-quest`, `.quest-ring`, `.quick-practice-*`, `.achievement-drawer`, `.practice-custom` |
| Mascot/reminders | `.pengo-*`, `.practice-coach`, `.celebration-sparkles`, `.reminder-*` |
| Quiz/results | `.quiz-*`, `.correct`, `.wrong` |

The main navigation switch is at 860/861 px. Other rules handle narrow content, tablets/desktops, and short landscape screens. Safe-area insets protect mobile edges. Japanese fonts are system fallbacks; no web-font download is defined. Later rules override earlier sections, so inspect the cascade before appending duplicate selectors.

The adventure section supplies warm/teal theme overrides, matching dark colors, raised controls, and brief finite animations. Home and Learn use the same real-progress card. Learn keeps custom quiz fields in a details disclosure (open for specific type/level or plan links); quick quiz starts cannot replace a saved quiz. The learning entry stays available with a saved quiz. Subject title/count rows wrap inside responsive cards. See [design and reminders](design-and-reminders.md) for the generated asset and notification behavior.

## Accessibility and lifecycle

Existing support includes a skip link, navigation labels/current state, semantic buttons, visible focus, Japanese `lang` attributes, progressbar values, and reduced-motion handling. Onboarding declares a modal dialog and supports swipe/back/skip. These features do not establish audited conformance: focus trapping/restoration and screen-reader behavior need manual review.

Timers include visible-time tracking (15 seconds), delayed notes/search, progress refresh, stroke animation, and browser reminder checks (30 seconds). The reminder permission callback checks whether its panel remains attached. `stopStrokeTimers()` exists, but rendering does not centrally cancel every asynchronous action. Rapid navigation can expose stale responses; account for lifecycle when changing asynchronous view code.

Vocabulary cards contain a `.vocab-card-link`. Voice controls/settings are removed. Discovery cards use two accessible faces; the inactive face is inert and hidden from assistive technology. Details/ratings stay hidden until reveal, and swipe/keyboard advance requires a prior rating. Reduced-motion users get an immediate flip. See [discovery cards](discovery-cards.md).

## Restored study plan and personal settings

`studyLevels`, `studyLevel`, and `inStudyLevel` in `app.js` centralize the active level. A plan takes priority over route level parameters, and browsing/search/related links/practice filter to that level. Without a plan, free level selection and reviews across levels remain available. `#/settings?section=plan` scrolls to the first Settings card.

The setup view uses `.plan-*` level and pace buttons with `aria-pressed`, a live summary, validated custom pace, and an optional exam date. Settings uses `.settings-*` cards, a mascot header, a desktop two-column grid, and one column on mobile. Existing backup, theme, autoplay, intro and reminder actions keep their IDs. Erasure has its own card and retains inline confirmation/cancellation. The soft danger button explicitly defines theme-specific foreground/background colors.

Progress uses shared theme tokens for its page/card backgrounds, text, chart and borders. Its summary uses aligned SVG book/clock/calendar icons; mobile navigation icons also have identical containers in active/inactive states.

## Flashcard access fix — 2026-10-09

Home and Learn offer **Today’s flashcards / Start learning**. The entry opens daily learning directly and resumes a saved deck before selecting more items. New decks use remaining current-batch items with a plan, or remaining daily-goal items without one, with at most ten cards. Once that target is met, Keep learning opens another deck of unstudied items, avoiding items already practiced today. Pause opens the optional `choose=1` hub. Switching quiz/cards preserves the other format in `practice.pausedSession`. The compact player uses flat overlapping faces for reliable Android rendering, an explicit meaning, Japanese 音読み/訓読み labels, and available example furigana. Got it advances immediately; Still learning retains feedback and manual advance. Daily challenges are status only; the daily subject tiles link to `#/today`.

Learning-card detail links carry a validated session ID rather than an arbitrary return URL. The back link returns to the same cursor and revealed face; related details propagate this context. Before leaving the deck, its browser-history entry becomes the resumable card route so native/browser Back also returns correctly. Ordinary detail pages retain their browser links.
