# All-level exploration and daily word — 2026-10-09

Global dictionary search spans vocabulary from all five JLPT levels and matches only Japanese spellings/readings or English meanings. It excludes examples, kanji and grammar records and caps results at 120 words. Both global inputs say “Search any word.” Related kanji/components/vocabulary/grammar links still span all five levels. The active plan controls Learn browsers and every flashcard/quiz/review pool. Outside-plan details show a Just exploring notice and remove learned/favorite/note/quiz controls. Existing progress is retained. Overlapping kanji in the active syllabus retain the target-level record. Learn browser placeholders name their chosen level.

Actual Back buttons on detail/browser, today, Progress and setup pages traverse app-owned history. Query replacements preserve the history marker and multi-word queries decode correctly. Reload preserves the path through related items. A direct-open detail falls back to its browser; validated learning-deck context supplies a card fallback. Flashcards keep their Pause & save control to preserve the compact player.

Cards rotate around the Y axis for 550ms and show complete meaning/readings on their answer face. Both faces are native buttons: tap or use Enter/Space to flip in either direction. There is no separate Show the front again control. The inactive face is inert and hidden from assistive technology. Reduced motion flips instantly. Reveal alone never grades or marks learning.

Today’s word sits directly below Home’s hero. Pengo gives three gentle bobs, then rests. Tapping reveals the local-date-selected word, reading, meaning and detail link; tapping again collapses it. Revealing scrolls the card into view so phone users can see the meaning immediately. This does not record learning. Reduced motion disables decorative motion. Settings begins with a plain Settings heading; the Your little corner card is removed.

## Mascot assets and exact prompts

Generated with the built-in imagegen tool using `assets/pengo-mascot.png` as the identity reference. PNGs were copied into the project without raster edits, preserving transparency. Both complete characters were inspected before use. Originals remain available. The existing complete adventure mascot remains on Home/setup, with mobile sizing constrained to its column.

- [pengo-discover.png](../assets/pengo-discover.png): daily word invitation and study coach.
- [pengo-celebrate.png](../assets/pengo-celebrate.png): correct quiz feedback and session completion.

Discovery prompt:

> Use case: illustration-story. Asset type: transparent PNG mascot for Pengo Japanese learning app daily word reveal and study coach. Reference image: preserve this Pengo character identity, round navy baby penguin with white heart shaped face/belly, tiny tuft, black round eyes, rosy cheeks, golden beak/feet, blue backpack, polished friendly cartoon illustration. Draw ONE complete full-body Pengo standing and holding a small mint green closed book in one flipper, the other flipper raised invitingly as if saying 'I found a word for you!'. Eyes open, cheerful curious smile. Clean smooth edges and restrained soft shading, easily readable at 96px. Entire tuft, raised flipper, both feet, backpack and book fully visible; centered in square frame with 10 percent transparent margin on every side. No surrounding objects, no letters, no text, no shadow outside character, no cropped parts. Real transparent background.

Celebration prompt:

> Use case: illustration-story. Asset type: polished transparent PNG celebration mascot for Pengo Japanese learning app. Reference image role: preserve Pengo character identity and illustration style. Single full body navy baby penguin Pengo with white heart shaped face and belly, tiny tuft, rosy pink cheeks, golden beak and two golden feet, blue backpack. Happy smiling closed crescent eyes, both flippers raised to celebrate a finished lesson. Standing, both feet fully visible. No book. Clean smooth outlines, polished restrained shading suitable for small mobile UI. Center character within square frame with generous transparent margin (10 percent) on every side, entire tuft, both flippers, backpack and feet within bounds. No confetti, no other objects, no text or letters, no watermarks, no clipping, no detached pieces. Real transparent background.

## Validation

`tests/test_exploration_browser.cjs` covers all-level search for each content type, read-only state and mutation guards, scoped Learn queries, focus retention, Back/query/reload/direct-open behavior, related kanji outside the syllabus, search cap/deduplication, unchanged deck scope, intermediate 3D transforms, tap/keyboard flip-back, reduced motion, finite mascot animation, word reveal without learning, Settings removal, and mobile/tablet/desktop layouts in both themes. App time still accrues while the app is visible; this is excluded from comparisons of learning progress.

Physical Android WebView interaction is not covered by desktop Chrome checks.

Verified in isolated desktop Chrome contexts: 596 browser checks passed (120 exploration, 71 plan/settings, 98 daily learning, 34 flashcard access, 62 Home refinement, 49 discovery, 75 Learn/detail returns, 41 design/reminders, 46 practice). The npm rules suite passed (97 Course, 39 Practice, 17 Reminder, 7 worker checks, plus Dashboard rules). JavaScript syntax and diff whitespace checks passed. Phone/tablet/desktop screenshots and both new mascot PNGs were inspected; both assets have alpha transparency.

Docker debug APK assembly succeeded. APK and both local staging directories match 19 checked runtime/data/credit/mascot files. Final APK: `dist/pengo-debug.apk`, 21,572,086 bytes; SHA-256 `970624ba4d351fcc17e61a7658293ceeabcd5ba83581dbb1742c4fe5434a6829`. Physical Android-device interaction remains untested.

Kanji details show only the JLPT header badge. Components contain structural breakdowns with optional deeper exploration, while compact character/meaning pairs for the memory story live in Mnemonic. The memory warning uses plain language; source attribution and partial-shape notices remain. Vocabulary details omit JMdict ID badges. Home removes Pengo tips and keeps the greeting mascot static. Quiz completion varies with score (perfect / 80%+ / 50%+ / below 50%), with gentle book-holding Pengo for low scores and celebration sparkles only from 80%.
