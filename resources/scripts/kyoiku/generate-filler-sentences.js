// Fills the remaining gap after augment-words.js: words with no exact-target
// sentence match anywhere and no Tanaka Corpus (jed) substring hit. Node
// built-ins only.
//
// These are NOT sourced from any dictionary or corpus — they're short,
// mechanically templated sentences generated from the word itself and its
// `meaning` gloss, so every kyoiku-wordsN.json word has *something* on the
// answer reveal. They're deliberately simple/generic compared to the
// hand-picked or corpus-matched examples elsewhere in this file, and are
// original text (not copied from any commercial workbook), consistent with
// this repo's copyright constraints (see this directory's README).
//
// Classification uses the JMdict-style POS tag already present in many
// `meaning` strings (e.g. "exchange, replace [v.t.]") when there is one;
// falls back to a kana-ending heuristic (kanji-drill's own augmented
// okurigana words carry no tag) otherwise:
//   - [v.t.] (transitive verb, may combine with v.i.) -> それを + verb
//   - [v.i.] only                                     -> それが + verb (not
//     それは — see the comment at the call site)
//   - [adj.] tag, or untagged but ends in い            -> adjective
//   - untagged but ends in a verb-ending kana (transitivity unknown)
//                                                       -> bare verb, no
//                                                          subject/object
//                                                          guessed
//   - everything else                                  -> noun, "X が
//     好きです" ("I like X") rather than "これは X です" ("This is X") — the
//     latter is a pointing/definitional construction that doesn't logically
//     fit a lot of what ends up in this bucket (weather phenomena, abstract
//     nouns, pairs like 男女/大小): "これは青空です. (This is a blue sky.)"
//     reads as if pointing at a small object in your hand. "が好きです"
//     carries no such presupposition and is grammatical for any noun.
//
// English translations deliberately never conjugate the gloss (no "-s", no
// invented subject) — the gloss strings are free-form JMdict/curated text
// ("put out, send", "be saved, survive"), and guessing agreement wrong reads
// worse than a plain infinitive/label gloss. The one enrichment applied is
// appending "it" to a single-word transitive gloss ("Bend it." rather than
// bare "Bend."); anything with a space (multi-word/phrasal, e.g. "put out")
// is left as-is rather than risk misplacing the object ("put out it.").
//
// Re-run any time after augment-words.js, from kanji-data's repo root:
//   node scripts/kyoiku/augment-words.js
//   node scripts/kyoiku/generate-filler-sentences.js

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VERB_ENDINGS = new Set([...'るうくぐすつぬぶむ']);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

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

// First alternative before a comma OR semicolon, tag stripped, capitalized —
// meanings like "exchange, replace [v.t.]" or "up and down; population;
// 3rd day" carry several senses (comma-separated near-synonyms, semicolon-
// separated distinct senses); the first is the primary one.
function primaryGloss(meaning) {
  const cut = Math.min(
    ...[',', ';'].map((sep) => { const i = meaning.indexOf(sep); return i === -1 ? Infinity : i; })
  );
  const firstSense = Number.isFinite(cut) ? meaning.slice(0, cut) : meaning;
  const stripped = firstSense.replace(/\s*\[[^\]]*\]\s*/g, '').trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

// Deverbal nouns that happen to end in い (住まい "dwelling", not an i-
// adjective) — an ending-い word is treated as an adjective by default
// below, so these need to be excluded explicitly rather than guessed.
// Extend this list if a future word hits the same false positive.
const NOUN_I_EXCEPTIONS = new Set(['住まい', '匂い', '願い', '狙い', '幸い', '勢い', '戦い', '争い', '賑わい']);

// Words that end in a verb-ending kana purely by coincidence (真の verbs,
// not: 恐らく is the adverb "perhaps", not a verb ending in く) get their
// own hand-written filler sentence outright, since no generic template
// makes sense for them. Extend if another such false positive turns up.
const HAND_WRITTEN = {
  恐らく: { sentence: '恐らく、明日は晴れるだろう。', translation: 'It will perhaps be sunny tomorrow.' },
};

function classify(word, meaning) {
  const hasTag = (tag) => meaning.includes(`[${tag}`);
  if (hasTag('v.t.')) return 'transitive';
  if (hasTag('v.i.')) return 'intransitive';
  if (NOUN_I_EXCEPTIONS.has(word)) return 'noun';
  if (hasTag('adj.')) return word.endsWith('い') ? 'i-adjective' : 'na-adjective';
  if (word.endsWith('い')) return 'i-adjective';
  if (VERB_ENDINGS.has(word[word.length - 1])) return 'verb-unknown-transitivity';
  return 'noun';
}

// A bare gloss/label translation ("Bend.", "Come out.") rather than a
// constructed sentence — see the file header for why.
function verbTranslation(gloss, transitive) {
  if (transitive && !gloss.includes(' ')) return `${gloss} it.`;
  return `${gloss}.`;
}

function fillerFor(word, meaning) {
  if (HAND_WRITTEN[word]) return HAND_WRITTEN[word];
  const gloss = primaryGloss(meaning);
  switch (classify(word, meaning)) {
    case 'transitive':
      return { sentence: `必要なときにそれを${word}。`, translation: `It is possible to ${gloss.toLowerCase()} something when necessary.` };
    case 'intransitive':
      return { sentence: `ときどきそれが${word}ことがある。`, translation: `It is possible for something to ${gloss.toLowerCase()} sometimes.` };
    case 'verb-unknown-transitivity':
      return { sentence: `必要なときに${word}。`, translation: `It is possible to ${gloss.toLowerCase()} when necessary.` };
    case 'i-adjective':
      return { sentence: `これはとても${word}。`, translation: `This is very ${gloss.toLowerCase()}.` };
    case 'na-adjective':
      return { sentence: `これはとても${word.replace(/な$/, '')}です。`, translation: `This is very ${gloss.toLowerCase()}.` };
    default:
      return { sentence: `授業で${word}について学ぶ。`, translation: `We learn about ${gloss.toLowerCase()} in class.` };
  }
}

function isLegacyFiller(word, meaning, examples) {
  if (!examples || examples.length !== 1) return false;
  const legacy = fillerForLegacy(word, meaning);
  if (examples[0].sentence === legacy.sentence && examples[0].translation === legacy.translation) return true;
  const gloss = primaryGloss(meaning).toLowerCase();
  switch (classify(word, meaning)) {
    case 'transitive':
      return examples[0].sentence === `必要なときにそれを${word}。` && examples[0].translation === `I ${gloss} it when necessary.`;
    case 'intransitive':
      return examples[0].sentence === `ときどきそれが${word}ことがある。` && examples[0].translation === `Sometimes it ${gloss}.`;
    case 'verb-unknown-transitivity':
      return examples[0].sentence === `必要なときに${word}。` && examples[0].translation === `I ${gloss} when necessary.`;
    default:
      return examples[0].sentence === `授業で${word}について学ぶ。` && examples[0].translation === `We learn about ${gloss} in class.`;
  }
}

function fillerForLegacy(word, meaning) {
  const gloss = primaryGloss(meaning);
  switch (classify(word, meaning)) {
    case 'transitive': return { sentence: `それを${word}。`, translation: verbTranslation(gloss, true) };
    case 'intransitive': return { sentence: `それが${word}。`, translation: verbTranslation(gloss, false) };
    case 'verb-unknown-transitivity': return { sentence: `${word}。`, translation: verbTranslation(gloss, false) };
    case 'i-adjective': return { sentence: `これはとても${word}。`, translation: `This is very ${gloss.toLowerCase()}.` };
    case 'na-adjective': return { sentence: `これはとても${word}です。`, translation: `This is very ${gloss.toLowerCase()}.` };
    default: return { sentence: `${word}が好きです。`, translation: `I like ${gloss.toLowerCase()}.` };
  }
}

for (let g = 1; g <= 9; g++) {
  const wfile = `words/kyoiku-words${g}.json`;
  const words = readJson(wfile);
  let filled = 0;
  let refreshed = 0;
  for (const w of words) {
    if (!w.examples) {
      w.examples = [fillerFor(w.word, w.meaning)];
      filled++;
    } else if (isLegacyFiller(w.word, w.meaning, w.examples)) {
      w.examples = [fillerFor(w.word, w.meaning)];
      refreshed++;
    }
  }
  writeWords(wfile, words);
  console.log(g, 'filled', filled, 'refreshed', refreshed, 'of', words.length);
}
