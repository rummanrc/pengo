# Frontend reference

## Shell and rendering

`index.html` contains `.app`, `.sidebar`, `#sideNav`, `.topbar`, `#topSearch`, `#view`, `#creditsFooter`, and `#bottomNav`. `initChrome()` wires theme buttons and quick search. Credits are shown on Settings. Mobile navigation omits the Search tab; quick search is in the mobile topbar.

`render()` parses the hash, dispatches a renderer, marks navigation, focuses the main view with `preventScroll`, and scrolls to the top. Most views replace `#view.innerHTML` and then attach handlers. Unknown routes fall back to Home. Missing detail IDs show their renderer's empty/error state.

`go(hash)` rerenders when the hash is unchanged, otherwise lets `hashchange` trigger rendering. `parseHash()` uses `decodeURIComponent` on segments/query pairs; malformed percent encodings are not broadly guarded. Encode IDs/query text with `encodeURIComponent` when generating links. Query parsing is simple splitting, not full URLSearchParams form decoding.

## Route contract

| Hash route | Behavior | Owner |
| --- | --- | --- |
| `#/` | Adventure welcome, level picker or learning trail, actual daily progress | `renderHome`, `renderAdventureHome` |
| `#/learn?lv=N4` | Kanji/vocab/grammar/review tiles for a level | `renderLearn` |
| `#/kanji` or `#/kanji/N5` | Kanji browser; invalid/missing level defaults to N5 | `renderBrowse` |
| `#/kanji/<character>` | Detail if character exists in global index | Router, `renderDetail` |
| `#/k/<character>` | Canonical kanji detail link | `renderDetail` |
| `#/vocab` | Vocabulary level overview | `renderVocabHome` |
| `#/vocab/N5` | Vocabulary browser | `renderVocabBrowse` |
| `#/v/<id>` | Vocabulary detail | `renderVocabDetail` |
| `#/grammar` | Grammar level overview | `renderGrammarHome` |
| `#/grammar/N5` | Grammar browser | `renderGrammarBrowse` |
| `#/g/<id>` | Grammar detail | `renderGrammarDetail` |
| `#/review?kind=vocab&lv=N4` | Shared practice setup with vocabulary/N4 selected | `renderReview`, `renderPractice` |
| `#/practice` | Four quick starts, optional custom setup, and daily practice | `renderPractice` |
| `#/practice?mode=due&kind=vocab` | Due-only vocabulary across levels | Shared player |
| `#/practice?mode=mistakes` | Targeted mistake practice | Shared player |
| `#/practice?start=1&size=3` | Start three-question smart practice; resume if saved | Shared player |
| `#/practice?resume=1` | Resume valid saved session, or setup if absent | Shared player |
| `#/search?q=tree` | Combined reference search | `renderSearch` |
| `#/progress?level=N4&period=month` | Progress, selected hero level and rolling period | `renderProgress` |
| `#/settings` | Theme, autoplay, backup, erase, plan, about/intro | `renderSettings` |
| `#/settings?section=reminders` | Settings scrolled to opt-in reminder controls | Router, `bindReminderSettings` |
| `#/course` | Redirect to Home | `renderCourse` |
| `#/course/setup?target=N4` | Plan setup/change wizard | `renderCourseSetup` |
| `#/course/day` | Current batch, backlog, due links, quiz entry | `renderCourseDay` |
| `#/course/quiz` | Mixed quiz over unlocked question items | `renderCourseQuiz` |
| `#/course/reset` | Confirm ending the plan, then Home | `renderCourse` |
| `#/study?kind=grammar` | Legacy redirect into ordinary Review quiz | Router |

Course day/quiz requires a plan; without one it redirects to setup. Unknown course subroutes redirect Home. Review defaults to kanji and the active target or N5; Learn defaults to the active plan target or N5. Progress derives a default hero level from plan/progress when no valid `level` is provided.

### Browse parameters

All three browser views support `q` (query), `f` (filter), and `s` (sort). Default filter is `all`; default sort is `freq`.

| Content | `f` values | `s` values |
| --- | --- | --- |
| Kanji | `all`, `learned`, `unlearned`, `fav` | `default`, `freq`, `strokes`, `alpha`, `progress` |
| Vocabulary | `all`, `learned`, `unlearned`, `fav`, `nosent` | `default`, `freq`, `alpha`, `reading`, `progress` |
| Grammar | `all`, `learned`, `unlearned`, `fav` | `default`, `freq`, `alpha`, `progress` |

`tab=quiz` still appears in some links but is ignored by current Review dispatch; recall cards and due/mistake modes are selected in practice setup. Additional practice parameters are `mode=smart|due|mistakes|plan`, `kind=mixed|kanji|vocab|grammar`, `size=3|5|10`, and `format=quiz|recall`. Progress uses `level`, while Learn/Review use `lv`.

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

The adventure section supplies warm/teal theme overrides, matching dark colors, raised controls, and brief finite animations. Home and Review use the same real-progress card. Review keeps custom fields in a details disclosure (open for specific type/level or plan links); quick starts cannot replace a saved session. See [design and reminders](design-and-reminders.md) for the generated asset and notification behavior.

## Accessibility and lifecycle

Existing support includes a skip link, navigation labels/current state, semantic buttons, visible focus, Japanese `lang` attributes, progressbar values, and reduced-motion handling. Onboarding declares a modal dialog and supports swipe/back/skip. These features do not establish audited conformance: focus trapping/restoration and screen-reader behavior need manual review.

Timers include visible-time tracking (15 seconds), delayed notes/search, progress refresh, stroke animation, and browser reminder checks (30 seconds). The reminder permission callback checks whether its panel remains attached. `stopStrokeTimers()` exists, but rendering does not centrally cancel every asynchronous action. Rapid navigation can expose stale responses; account for lifecycle when changing asynchronous view code.
