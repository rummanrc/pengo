// Augments words/kyoiku-wordsN.json in three ways, from data already in this
// repo. Node built-ins only.
//
// 1. Okurigana words (e.g. 買う, 急ぐ, 食べる) — pulled from each kanji's own
//    `examples` in kanji/kyoiku-gradeN.json, filtered to entries whose word
//    is the kanji followed by kana only (this is what distinguishes an
//    inflected reading like 買う from a compound like 買い物 or 右手). Only
//    kanji with a dotted (okurigana-bearing) reading are considered. Words
//    already present in the words file (by exact text) are left untouched.
//
//    These are hoisted to the FRONT of each grade's word list (ahead of
//    compound words/熟語), whether newly added here or already present in
//    the file — this matters because word mode's question selector ties
//    all not-yet-seen items on score and breaks ties with a stable sort, so
//    array order IS learning order for a fresh learner: an elementary
//    student meets a kanji's own inflected reading (走る) before its
//    compounds (競走, 走者), and appending instead of hoisting would bury
//    them at the tail where they'd rarely surface. See CLAUDE.md's
//    "sourceGrade invariant" — reordering is safe because progress is keyed
//    by word text, never by array position.
//
// 2. Example sentences — attached to *every* word entry (new or
//    pre-existing) whose text exactly matches a sentence's `target` in ANY
//    grade's sentences/kyoiku-sentencesN.json (a word can be taught in one
//    grade's word list but exampled by a sentence written for a kanji
//    introduced in a different grade), up to 2 per word. If no grade has an
//    exact-target match, falls back to
//    sentences/jed-kanji-sentences.json — per-kanji sentences mirrored from
//    the Tanaka Corpus (see CREDITS.md; already licensed for use in this
//    repo) — matched by substring containment of the word inside a sentence
//    indexed under one of the word's own kanji.
//    Coverage is not 100% — a word with no match in either source simply
//    keeps no `examples` field; see the user-facing README for that caveat.
//
// Usage (from kanji-data's repo root), re-run after kanji/, words/, or
// sentences/ data grows for a grade:
//   node scripts/kyoiku/augment-words.js

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function isKana(c) {
  const cp = c.codePointAt(0);
  return (cp >= 0x3041 && cp <= 0x309f) // hiragana
    || (cp >= 0x30a0 && cp <= 0x30ff) // katakana
    || c === 'ー';
}

function coreReading(r) {
  const dot = r.indexOf('.');
  return dot === -1 ? r : r.slice(0, dot);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

// Matches the words files' existing one-entry-per-line style:
// `{ "word": "学校", "readings": ["がっこう"], "meaning": "school" }`.
function formatEntry(w) {
  const parts = [`"word": ${JSON.stringify(w.word)}`, `"readings": ${JSON.stringify(w.readings)}`, `"meaning": ${JSON.stringify(w.meaning)}`];
  if (w.examples) parts.push(`"examples": ${JSON.stringify(w.examples)}`);
  return `{ ${parts.join(', ')} }`;
}

function writeWords(relPath, words) {
  const lines = ['['];
  words.forEach((w, i) => {
    const comma = i < words.length - 1 ? ',' : '';
    lines.push('  ' + formatEntry(w) + comma);
  });
  lines.push(']');
  fs.writeFileSync(path.join(ROOT, relPath), lines.join('\n') + '\n', 'utf8');
}

// Is `word` this kanji plus a kana-only suffix (an inflected/okurigana form,
// as opposed to a compound like 買い物 or 右手)?
function isOkuriganaWord(word, kanjiChar) {
  return word.length >= 2 && word[0] === kanjiChar && [...word.slice(1)].every(isKana);
}

const jed = readJson('sentences/jed-kanji-sentences.json');

// All grades' sentences, indexed by exact target text — used both for a
// word's own grade and as a cross-grade fallback.
const sentencesByTarget = new Map();
for (let g = 1; g <= 9; g++) {
  for (const s of readJson(`sentences/kyoiku-sentences${g}.json`)) {
    if (!sentencesByTarget.has(s.target)) sentencesByTarget.set(s.target, []);
    sentencesByTarget.get(s.target).push(s);
  }
}

function jedExamplesFor(word) {
  for (const ch of word) {
    for (const ex of jed[ch] || []) {
      if (ex.jp.includes(word)) return [{ sentence: ex.jp, translation: ex.en || '' }];
    }
  }
  return null;
}

for (let g = 1; g <= 9; g++) {
  const kfile = `kanji/kyoiku-grade${g}.json`;
  const wfile = `words/kyoiku-words${g}.json`;
  const kanji = readJson(kfile);
  const words = readJson(wfile);

  const kanjiOf = new Map(kanji.map((k) => [k.kanji, k]));
  const existing = new Set(words.map((w) => w.word));
  for (const k of kanji) {
    if (!k.readings.some((r) => r.includes('.'))) continue;
    for (const ex of k.examples || []) {
      const w = ex.word;
      if (!isOkuriganaWord(w, k.kanji) || existing.has(w)) continue;
      existing.add(w);
      words.push({ word: w, readings: [coreReading(ex.reading)], meaning: ex.gloss });
    }
  }

  // Hoist every okurigana-form entry (old or new) ahead of compounds — see
  // the file header for why array order matters here.
  words.sort((a, b) => {
    const aOkuri = kanjiOf.has(a.word[0]) && isOkuriganaWord(a.word, a.word[0]) ? 0 : 1;
    const bOkuri = kanjiOf.has(b.word[0]) && isOkuriganaWord(b.word, b.word[0]) ? 0 : 1;
    return aOkuri - bOkuri;
  });

  for (const w of words) {
    const cands = sentencesByTarget.get(w.word); // merged across all 9 grades
    if (cands) {
      w.examples = cands.slice(0, 2).map((s) => ({
        sentence: s.sentence,
        translation: s.translation || s.meaning || '',
      }));
      continue;
    }
    const jedEx = jedExamplesFor(w.word);
    if (jedEx) w.examples = jedEx;
  }

  writeWords(wfile, words);
  const withEx = words.filter((w) => w.examples).length;
  console.log(g, 'words now', words.length, `(${withEx} with examples)`);
}
