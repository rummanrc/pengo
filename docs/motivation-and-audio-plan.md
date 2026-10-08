# Historical plan — superseded

The audio sections below describe the 2026-10-08 implementation. Voice pronunciation and listening were removed on 2026-10-09. The current daily card experience and component research are documented in [discovery cards](discovery-cards.md).

# Natural audio and a motivating Home

Requested outcome: improve robotic Japanese TTS using a free/open option, prepare a reusable audio path for future listening tests, and make Home show meaningful daily tasks and challenges.

## Implementation checklist

- [x] Research free Japanese neural TTS and document the choice, licenses, quality limits, and reproducible setup.
- [x] Generate and bundle neural vocabulary audio; preserve device speech as a clearly identified fallback.
- [x] Add audio settings with a preview, normal/slow playback, cancellation, and visible failure recovery.
- [x] Provide reusable sentence audio generation for future listening test content.
- [x] Add a short vocabulary listening session with hidden written prompts until the answer, explicit playback, and honest grading.
- [x] Show today's distinct kanji, vocabulary, and grammar studied/practiced, plus attempts and daily-goal progress.
- [x] Add rotating daily challenges with real progress, actionable links, and no penalty for missed days.
- [x] Add a daily word discovery, useful next steps, weekly activity, and supportive completion messages.
- [x] Verify desktop/mobile, light/dark, reloads, old backups, midnight rollover, audio failures, and offline packaging.
- [x] Update product, storage, audio, build, and testing documentation with actual validation evidence.

Completed implementation evidence: all 8,293 vocabulary records covered by 7,033 reading clips, plus three sentence clips; all 7,036 MP3s decoded. Real playback passes over HTTP and staged `file://`. Dashboard/neural browser checks (41), device speech (35), shared practice (46), design/reminders (40), and native tests (33) pass. The debug APK builds and its 9,463 web assets match the staged bundle. See [verification](verification.md) for the detailed record and remaining physical-device/editorial acceptance limits.

## Design choices

- Keep the static/offline app. Generate neural speech during content preparation; ship compressed audio rather than an inference model, paid service, or background download in the learner's app.
- Use Kokoro-82M `jf_alpha` with Japanese Misaki phonemization. Its model and inference code are Apache-2.0. Neural audio still needs listening review, particularly short words and pitch accent; do not call generated speech native recordings or exam-validated audio.
- Key clips by voice, speed, text, and generator version; map vocabulary IDs to clips without changing content IDs. Repeated readings reuse a file. Extend the generator with an explicit sentence input manifest.
- Count unique study items from the durable daily activity ledger. Repeated answers increase attempts, not distinct-item goals. Daily challenges follow the local date and current level; low goals remain achievable.
- Listening practice uses bundled clips and requires successful playback before answers become available. A broken clip must never silently turn a listening question into a written one.

## Later content track

- Have a proficient Japanese speaker review pitch, pronunciation, and listening-test scripts before using them for assessment.
- Add level-specific authored dialogues with multiple speakers, comprehension questions, transcripts after answering, and normal/slow variants.
- Compare VOICEVOX against Kokoro for Japanese prosody if pilot review finds Kokoro's short-word quality insufficient. VOICEVOX has per-character terms and attribution requirements in addition to its engine license.
- Consider optional downloadable voice packs only if bundled audio size becomes a distribution problem.
