"use strict";
/* KnowKanji - data-driven JLPT kanji study app (no build step).
   Data: data/n5..n1.json + data/radicals.json + data/meta.json (see scripts/build_data.py).
   Vocab: data/vocab_n5..n1.json + data/vocab_meta.json (see scripts/build_vocab.py).
   Grammar: data/grammar_n5..n1.json + data/grammar_meta.json (see scripts/build_grammar.py).
   Progress: localStorage key "knowkanji:v1". */

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const STORE_KEY = "knowkanji:v1";
const STROKE_BASE = "resources/stroke-order/kanjivg/";

const DB = { levels: {}, byChar: {}, vocab: {}, vById: {}, grammar: {}, gById: {}, meta: null, vocabMeta: null, grammarMeta: null, radicals: [], loaded: false };

const defaultStore = () => ({ learned: {}, fav: [], notes: {}, srs: {}, vLearned: {}, vFav: [], vNotes: {}, vSrs: {}, gLearned: {}, gFav: [], gNotes: {}, gSrs: {},
  settings: { theme: "light", dailyGoal: 10, autoplay: true }, quizBest: {}, vQuizBest: {}, gQuizBest: {} });

let store = defaultStore();
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) store = Object.assign(defaultStore(), JSON.parse(raw));
} catch (e) { /* fresh start */ }
if (!store.settings) store.settings = defaultStore().settings;
for (const _k of ["vLearned", "vNotes", "vSrs", "vQuizBest", "gLearned", "gNotes", "gSrs", "gQuizBest"]) if (!store[_k]) store[_k] = {};
if (!store.vFav) store.vFav = [];
if (!store.gFav) store.gFav = [];
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* full/blocked */ }
}

function exportBackup() {
  const text = JSON.stringify(store);
  if (window.Platform && window.Platform.exportJson) { window.Platform.exportJson("knowkanji-backup.json", text); return; }
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "knowkanji-backup.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
function storeNote() {
  if (window.Platform && window.Platform.backingStoreNote) return window.Platform.backingStoreNote();
  return "Progress is stored privately in this browser (localStorage). Export a backup before switching devices.";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function kataToHira(s) {
  return String(s || "").replace(/[ァ-ン]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function foldReading(s) {
  return kataToHira(s).replace(/[.·\s・]/g, "").toLowerCase();
}
function foldEnglish(s) { return String(s || "").toLowerCase().trim(); }
function $(sel, root) { return (root || document).querySelector(sel); }
function $$ (sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function levelClass(lv) { return (lv || "").toLowerCase(); }
function isLearned(ch) { return !!store.learned[ch]; }
function isFav(ch) { return store.fav.indexOf(ch) !== -1; }
function statusDot(ch) {
  if (isLearned(ch)) return "<span class=\"dot learned\" title=\"Learned\"></span>";
  if (store.srs[ch]) return "<span class=\"dot learning\" title=\"Learning\"></span>";
  return "<span class=\"dot\" title=\"Not started\"></span>";
}

/* ---------- Mnemonic engine (AI-ready) ----------
   Rule-based generator ships with the app; a future LLM can replace
   KanjiMnemonic.generateViaModel without touching the UI. */
const KanjiMnemonic = {
  templates: {
    two: [
      "A {a} trips over {b} in the middle of a crowded street. The whole crowd gasps: that is {meaning}!",
      "{A} throws a wild party and invites {b}. Things get completely out of hand, and the neighbors remember the night as pure {meaning}.",
      "Picture {a} giving {b} an enormous bear hug. That warm, ridiculous collision is the very image of {meaning}.",
      "{A} challenges {b} to a sumo match and wins by a landslide. The trophy is engraved with one word: {meaning}.",
      "A {a} opens a tiny shop selling {b}. The sign above the door says {meaning}, and customers line up around the block."
    ],
    three: [
      "{A}, {b} and {c} start a chaotic band together. Their debut hit single is titled {meaning}.",
      "Stack {a} on {b} on {c} like a wobbly pancake tower. Step back and admire your {meaning} before it topples over.",
      "{A} introduces {b} to {c} at a noisy summer festival. That unforgettable meeting is {meaning}."
    ],
    one: [
      "Zoom in on {a} until it fills the whole sky. That single giant image burns {meaning} into your memory.",
      "{A} strikes a dramatic hero pose and shouts: I am {meaning}! Applaud loudly so you never forget it."
    ],
    atomic: [
      "{A} is a foundation stone of written Japanese: a basic building block that simply is {meaning}. Picture it carved in glowing rock.",
      "No assembly required: {a} just means {meaning}. Whisper {meaning} three times while tracing the shape in the air."
    ],
    many: [
      "Toss {items} into a blender, hit maximum speed, and pour out a steaming bowl of {meaning}.",
      "Line up {items} for a group photo. The photographer shouts {meaning}! Everybody grins."
    ]
  },
  pick(list, key) {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.codePointAt(0)) % 1000003;
    return list[h % list.length];
  },
  /* generate({kanji, meaning, parts:[meanings], on, kun}) -> {text, notice} */
  generate(input) {
    const words = (input.parts || []).filter(Boolean);
    const ctx = { meaning: input.meaning || input.kanji, a: words[0] || "",
      A: "", b: words[1] || "", c: words[2] || "" };
    if (ctx.a) ctx.A = ctx.a.slice(0, 1).toUpperCase() + ctx.a.slice(1);
    let story;
    if (words.length === 1 && words[0].toLowerCase() === String(ctx.meaning).toLowerCase())
      story = this.pick(this.templates.atomic, input.kanji).replace("{A}", ctx.A).replace("{a}", ctx.a).replaceAll("{meaning}", ctx.meaning);
    else if (words.length <= 1)
      story = this.pick(this.templates.one, input.kanji).replace("{A}", ctx.A).replace("{a}", ctx.a).replaceAll("{meaning}", ctx.meaning);
    else if (words.length === 2)
      story = this.pick(this.templates.two, input.kanji).replace("{A}", ctx.A).replace("{a}", ctx.a).replaceAll("{b}", ctx.b).replaceAll("{meaning}", ctx.meaning);
    else if (words.length === 3)
      story = this.pick(this.templates.three, input.kanji).replace("{A}", ctx.A).replace("{a}", ctx.a).replaceAll("{b}", ctx.b).replaceAll("{c}", ctx.c).replaceAll("{meaning}", ctx.meaning);
    else {
      const items = words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
      story = this.pick(this.templates.many, input.kanji).replace("{items}", items).replaceAll("{meaning}", ctx.meaning);
    }
    const rd = (input.on || []).concat(input.kun || [])[0];
    if (rd) story += " Chant " + rd + " while picturing the scene.";
    return { text: story, notice: "Memory aid, not etymology." };
  },
  /* Future LLM hook: set KanjiMnemonic.generateViaModel = async (input) => "..." */
  generateViaModel: null,
  async generateSmart(input, fallback) {
    if (this.generateViaModel) {
      try { return { text: await this.generateViaModel(input), notice: "Generated with AI." }; }
      catch (e) { /* fall through */ }
    }
    return fallback || this.generate(input);
  }
};

function mnemonicFor(item) {
  if (item.mnemonic) return { text: item.mnemonic, notice: "Memory aid, not etymology." };
  return KanjiMnemonic.generate({ kanji: item.k, meaning: item.meaning,
    parts: item.components.map(c => c.m), on: item.on, kun: item.kun });
}

/* ---------- Data loading ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("bundle missing"));
    document.head.appendChild(s);
  });
}
async function loadData() {
  try {
    await loadDataFetch();
    DB.source = "fetch";
  } catch (e) {
    await loadScript("data/bundle.js");
    DB.source = "bundle";
    const b = window.KK_DATA;
    if (!b || !b.levels) throw e;
    DB.levels = b.levels;
    DB.meta = b.meta;
    DB.radicals = b.radicals || [];
    DB.vocab = b.vocab || {};
    DB.grammar = b.grammar || {};
    DB.vocabMeta = b.vocabMeta || null;
    DB.grammarMeta = b.grammarMeta || null;
  }
  for (const lv of LEVELS)
    for (const it of DB.levels[lv]) DB.byChar[it.k] = { item: it, level: lv };
  DB.vById = {};
  for (const lv of LEVELS)
    for (const v of (DB.vocab[lv] || [])) DB.vById[v.id] = v;
  DB.gById = {};
  for (const lv of LEVELS)
    for (const g of (DB.grammar[lv] || [])) DB.gById[g.id] = g;
  DB.loaded = true;
}
async function loadDataFetch() {
  const [n5, n4, n3, n2, n1, meta, radicals, v5, v4, v3, v2, v1, vmeta, g5, g4, g3, g2, g1, gmeta] = await Promise.all([
    fetch("data/n5.json").then(r => r.json()),
    fetch("data/n4.json").then(r => r.json()),
    fetch("data/n3.json").then(r => r.json()),
    fetch("data/n2.json").then(r => r.json()),
    fetch("data/n1.json").then(r => r.json()),
    fetch("data/meta.json").then(r => r.json()),
    fetch("data/radicals.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_n5.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_n4.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_n3.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_n2.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_n1.json").then(r => r.json()).catch(() => []),
    fetch("data/vocab_meta.json").then(r => r.json()).catch(() => null),
    fetch("data/grammar_n5.json").then(r => r.json()).catch(() => []),
    fetch("data/grammar_n4.json").then(r => r.json()).catch(() => []),
    fetch("data/grammar_n3.json").then(r => r.json()).catch(() => []),
    fetch("data/grammar_n2.json").then(r => r.json()).catch(() => []),
    fetch("data/grammar_n1.json").then(r => r.json()).catch(() => []),
    fetch("data/grammar_meta.json").then(r => r.json()).catch(() => null)
  ]);
  DB.levels = { N5: n5, N4: n4, N3: n3, N2: n2, N1: n1 };
  DB.meta = meta; DB.radicals = radicals;
  DB.vocab = { N5: v5, N4: v4, N3: v3, N2: v2, N1: v1 };
  DB.vocabMeta = vmeta;
  DB.grammar = { N5: g5, N4: g4, N3: g3, N2: g2, N1: g1 };
  DB.grammarMeta = gmeta;
}
function allItems() {
  const out = [];
  for (const lv of LEVELS) for (const it of DB.levels[lv]) out.push({ item: it, level: lv });
  return out;
}
function levelStats(lv) {
  const items = DB.levels[lv] || [];
  let learned = 0;
  for (const it of items) if (store.learned[it.k]) learned++;
  return { total: items.length, learned, left: items.length - learned,
    pct: items.length ? Math.round(learned / items.length * 100) : 0 };
}
function dueCount() {
  const now = Date.now();
  let n = 0;
  for (const k of Object.keys(store.srs)) if (store.srs[k].due <= now) n++;
  for (const k of Object.keys(store.vSrs || {})) if (store.vSrs[k].due <= now && DB.vById[k]) n++;
  for (const k of Object.keys(store.gSrs || {})) if (store.gSrs[k].due <= now && DB.gById[k]) n++;
  return n;
}

/* ---------- Router ---------- */
const NAV = [
  { path: "#/", label: "Home", ico: "🏠", match: "home" },
  { path: "#/kanji", label: "Kanji", ico: "漢", match: "kanji" },
  { path: "#/vocab", label: "Vocab", ico: "語", match: "vocab" },
  { path: "#/grammar", label: "Grammar", ico: "文", match: "grammar" },
  { path: "#/review", label: "Review", ico: "🔁", match: "review" },
  { path: "#/search", label: "Search", ico: "🔍", match: "search" },
  { path: "#/progress", label: "Progress", ico: "📊", match: "progress" },
  { path: "#/settings", label: "Settings", ico: "⚙", match: "settings" }
];
function parseHash() {
  const h = location.hash || "#/";
  const [pathPart, queryPart] = h.slice(1).split("?");
  const seg = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const q = {};
  if (queryPart) for (const kv of queryPart.split("&")) {
    const [k, v] = kv.split("=");
    q[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return { seg, q };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function renderNav(active) {
  const html = NAV.map(n =>
    "<a href=\"" + n.path + "\"" + (n.match === active ? " aria-current=\"page\"" : "") + ">" +
    "<span class=\"ico\" aria-hidden=\"true\">" + n.ico + "</span><span>" + n.label + "</span></a>").join("");
  $("#sideNav").innerHTML = html;
  $("#bottomNav").innerHTML = NAV.filter(n => ["home", "kanji", "vocab", "grammar", "review", "settings"].indexOf(n.match) >= 0).map(n =>
    "<a href=\"" + n.path + "\"" + (n.match === active ? " aria-current=\"page\"" : "") + ">" +
    "<span class=\"ico\" aria-hidden=\"true\">" + n.ico + "</span><span>" + n.label + "</span></a>").join("");
  const d = dueCount();
  const pill = $("#duePill");
  if (d > 0) { pill.hidden = false; pill.textContent = d + " due"; }
  else pill.hidden = true;
}
async function render() {
  if (!DB.loaded) { $("#view").innerHTML = "<p class=\"empty\">Loading kanji data...</p>"; return; }
  const { seg, q } = parseHash();
  const view = $("#view");
  const name = seg[0] || "home";
  if (name === "kanji" && seg[1] && DB.byChar[seg[1]]) { renderNav("kanji"); renderDetail(view, seg[1]); }
  else if (name === "kanji") { renderNav("kanji"); renderBrowse(view, seg[1], q); }
  else if (name === "k" && seg[1]) { renderNav("kanji"); renderDetail(view, seg[1]); }
  else if (name === "vocab" && seg[1]) { renderNav("vocab"); renderVocabBrowse(view, seg[1], q); }
  else if (name === "vocab") { renderNav("vocab"); renderVocabHome(view); }
  else if (name === "v" && seg[1]) { renderNav("vocab"); renderVocabDetail(view, seg[1]); }
  else if (name === "grammar" && seg[1]) { renderNav("grammar"); renderGrammarBrowse(view, seg[1], q); }
  else if (name === "grammar") { renderNav("grammar"); renderGrammarHome(view); }
  else if (name === "g" && seg[1]) { renderNav("grammar"); renderGrammarDetail(view, seg[1]); }
  else if (name === "study") { // removed study, redirect to quiz
    if (q.kind === "vocab") go("#/review?tab=quiz&kind=vocab");
    else if (q.kind === "grammar") go("#/review?tab=quiz&kind=grammar");
    else go("#/review?tab=quiz");
  }
  else if (name === "review") {
    if (q.kind === "vocab") { renderNav("review"); renderVReview(view, q); }
    else if (q.kind === "grammar") { renderNav("review"); renderGReview(view, q); }
    else { renderNav("review"); renderReview(view, q); }
  }
  else if (name === "search") { renderNav("search"); renderSearch(view, q); }
  else if (name === "progress") { renderNav("progress"); renderProgress(view); }
  else if (name === "settings") { renderNav("settings"); renderSettings(view); }
  else { renderNav("home"); renderHome(view); }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

/* ---------- Shared widgets ---------- */
function kanjiCard(it, lv) {
  const fav = isFav(it.k) ? "<span class=\"fav-star\" aria-label=\"Favorite\">★</span>" : "";
  const read = (it.on[0] || it.kun[0] || "");
  return "<a class=\"kcard\" href=\"#/k/" + encodeURIComponent(it.k) + "\">" + fav +
    "<span class=\"char jp\" lang=\"ja\">" + esc(it.k) + "</span>" +
    "<span class=\"mean\">" + esc(it.meaning) + "</span>" +
    "<span class=\"read\" lang=\"ja\">" + esc(read) + "</span>" +
    "<span class=\"meta\"><span class=\"badge " + levelClass(lv) + "\">" + lv + "</span>" + statusDot(it.k) + "</span></a>";
}
function progressBar(pct) {
  return "<div class=\"progress-track\" role=\"progressbar\" aria-valuenow=\"" + pct + "\" aria-valuemin=\"0\" aria-valuemax=\"100\">" +
    "<div class=\"progress-fill\" style=\"width:" + pct + "%\"></div></div>";
}
function toggleLearned(ch) {
  if (store.learned[ch]) {
    delete store.learned[ch];
  } else {
    store.learned[ch] = Date.now();
    if (!store.srs[ch]) store.srs[ch] = { box: 1, due: Date.now() + 864e5 };
  }
  save();
}
function toggleFav(ch) {
  const i = store.fav.indexOf(ch);
  if (i >= 0) store.fav.splice(i, 1); else store.fav.push(ch);
  save();
}

/* ---------- Home ---------- */
function renderHome(view) {
  const due = dueCount();
  const cards = LEVELS.map(lv => {
    const s = levelStats(lv);
    return "<a class=\"level-card\" href=\"#/kanji/" + lv + "\">" +
      "<div class=\"lvl\">JLPT <span lang=\"en\">" + lv + "</span> <small>" + s.total + " kanji</small></div>" +
      "<div class=\"count\">" + s.learned + " / " + s.total + " learned</div>" +
      progressBar(s.pct) + "<div class=\"progress-label\">" + s.pct + "% complete · " + s.left + " left</div></a>";
  }).join("");
  const total = DB.meta ? DB.meta.total : allItems().length;
  const vTotal = DB.vocabMeta ? DB.vocabMeta.total : vAll().length;
  const vDue = vDueCount();
  const gTotal = DB.grammarMeta ? DB.grammarMeta.total : gAll().length;
  const gDue = gDueCount();
  const gcards = LEVELS.map(lv => {
    const s = gLevelStats(lv);
    return "<a class=\"level-card\" href=\"#/grammar/" + lv + "\">" +
      "<div class=\"lvl\">JLPT <span lang=\"en\">" + lv + "</span> <small>" + s.total + " points</small></div>" +
      "<div class=\"count\">" + s.learned + " / " + s.total + " learned</div>" +
      progressBar(s.pct) + "<div class=\"progress-label\">" + s.pct + "% complete</div></a>";
  }).join("");
  const vcards = LEVELS.map(lv => {
    const s = vLevelStats(lv);
    return "<a class=\"level-card\" href=\"#/vocab/" + lv + "\">" +
      "<div class=\"lvl\">JLPT <span lang=\"en\">" + lv + "</span> <small>" + s.total + " words</small></div>" +
      "<div class=\"count\">" + s.learned + " / " + s.total + " learned</div>" +
      progressBar(s.pct) + "<div class=\"progress-label\">" + s.pct + "% complete</div></a>";
  }).join("");
  view.innerHTML =
    "<h1>Learn kanji and vocabulary, one level at a time</h1>" +
    "<p class=\"lead\">Pick a JLPT level, browse kanji, break each one into components, remember it with a silly mnemonic, then lock it in with review quizzes. " + total + " kanji, " + vTotal + " vocabulary words and " + gTotal + " grammar points included.</p>" +
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/review\">🔁 Review now — " + due + " due</a></p>" : "") +
    "<h2>Kanji</h2>" +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<h2>Vocabulary <small><a href=\"#/vocab\">open vocab</a></small></h2>" +
    (vDue > 0 ? "<p><a class=\"btn primary\" href=\"#/review?tab=quiz&kind=vocab\">Practice vocab now &mdash; " + vDue + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + vcards + "</div>" +
    "<h2>Grammar <small><a href=\"#/grammar\">open grammar</a></small></h2>" +
    (gDue > 0 ? "<p><a class=\"btn primary\" href=\"#/review?tab=quiz&kind=grammar\">Practice grammar now &mdash; " + gDue + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + gcards + "</div>" +
    "<div class=\"card\"><h2>How it works</h2>" +
    "<p class=\"explain\">JLPT → Kanji → Components → Funny mnemonic → Vocabulary → Review. " +
    "Components marked with a Kangxi number (e.g. 木 #75) are true Kangxi radicals; the rest are " +
    "memory helpers from KRADFILE — the app always labels which is which. Mnemonics are original memory aids, not etymology.</p>" +
    "<p><a class=\"btn\" href=\"#/review?tab=quiz\">Take a quiz</a> <a class=\"btn soft\" href=\"#/search\">Search kanji</a></p></div>";
}

/* ---------- Browse ---------- */
function matchQuery(rec, q) {
  if (!q) return true;
  const f = foldEnglish(q);
  if (!f) return true;
  const it = rec.item;
  if (it.k === q.trim()) return true;
  if (foldEnglish(it.meaning).includes(f)) return true;
  if ((it.meanings || []).some(m => foldEnglish(m).includes(f))) return true;
  const rq = foldReading(q);
  if (rq && (it.on.concat(it.kun).some(r => foldReading(r).includes(rq)))) return true;
  return false;
}
function renderBrowse(view, level, q) {
  const lv = LEVELS.includes((level || "").toUpperCase()) ? level.toUpperCase() : "N5";
  const query = q.q || "", filt = q.f || "all", sort = q.s || "default";
  const link = (over) => "#/kanji/" + lv + "?" + new URLSearchParams(Object.assign({ q: query, f: filt, s: sort }, over)).toString();
  let recs = DB.levels[lv].map(item => ({ item, level: lv }));
  recs = recs.filter(r => matchQuery(r, query));
  if (filt === "learned") recs = recs.filter(r => isLearned(r.item.k));
  else if (filt === "unlearned") recs = recs.filter(r => !isLearned(r.item.k));
  else if (filt === "fav") recs = recs.filter(r => isFav(r.item.k));
  if (sort === "strokes") recs.sort((a, b) => (a.item.strokes || 99) - (b.item.strokes || 99));
  else if (sort === "freq") recs.sort((a, b) => (a.item.freq || 99999) - (b.item.freq || 99999));
  else if (sort === "alpha") recs.sort((a, b) => (a.item.meaning < b.item.meaning ? -1 : 1));
  else if (sort === "progress") recs.sort((a, b) => ((store.learned[a.item.k] ? 1 : 0) - (store.learned[b.item.k] ? 1 : 0)));
  const chips = LEVELS.map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(r => kanjiCard(r.item, r.level)).join("") :
    "<p class=\"empty\">No kanji match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Browse kanji</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"bq\" placeholder=\"Search kanji, meaning, reading...\" value=\"" + esc(query) + "\" aria-label=\"Search kanji\">" +
    "<select id=\"bf\" aria-label=\"Filter\"><option value=\"all\">All</option>" +
    "<option value=\"learned\"" + (filt === "learned" ? " selected" : "") + ">Learned</option>" +
    "<option value=\"unlearned\"" + (filt === "unlearned" ? " selected" : "") + ">Unlearned</option>" +
    "<option value=\"fav\"" + (filt === "fav" ? " selected" : "") + ">★ Favorites</option></select>" +
    "<select id=\"bs\" aria-label=\"Sort\"><option value=\"default\">Default order</option>" +
    "<option value=\"strokes\"" + (sort === "strokes" ? " selected" : "") + ">Fewest strokes</option>" +
    "<option value=\"freq\"" + (sort === "freq" ? " selected" : "") + ">Most frequent</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">Meaning A–Z</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option></select>" +
    "</div>" +
    "<p class=\"result-count\">" + recs.length + " / " + DB.levels[lv].length + " kanji · " + lv + "</p>" +
    "<div class=\"kanji-grid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/kanji/" + c.dataset.lv)));
  let deb = null;
  $("#bq").addEventListener("input", e => {
    clearTimeout(deb);
    deb = setTimeout(() => go(link({ q: e.target.value })), 300);
  });
  $("#bf").addEventListener("change", e => go(link({ f: e.target.value })));
  $("#bs").addEventListener("change", e => go(link({ s: e.target.value })));
}

/* ---------- Detail ---------- */
function compRow(c) {
  const tags = [];
  if (c.rad) tags.push("<span class=\"badge\">Kangxi #" + c.rad + "</span>");
  if (c.isKanji) tags.push("<span class=\"badge\">kanji</span>");
  if (c.variantOf) tags.push("<span class=\"badge\">variant of " + esc(c.variantOf) + "</span>");
  const inner = "<span class=\"cchar jp\" lang=\"ja\">" + esc(c.c) + "</span>" +
    "<span class=\"cinfo\"><span class=\"cm\">" + (esc(c.m) || "—") + "</span><br>" +
    "<span class=\"explain\">" + (c.rad ? "True Kangxi radical. " : "Mnemonic component (KRADFILE). ") +
    (c.variantOf ? "Written here as " + esc(c.c) + ", standard form " + esc(c.variantOf) + ". " : "") +
    tags.join(" ") + "</span></span>";
  if (c.link && DB.byChar[c.link])
    return "<a class=\"comp\" href=\"#/k/" + encodeURIComponent(c.link) + "\">" + inner + "</a>";
  return "<div class=\"comp\">" + inner + "</div>";
}
function renderDetail(view, ch) {
  const rec = DB.byChar[ch];
  if (!rec) { view.innerHTML = "<p class=\"empty\">Kanji not found. <a href=\"#/kanji\">Back to browser</a></p>"; return; }
  const it = rec.item, lv = rec.level;
  const list = DB.levels[lv];
  const idx = list.findIndex(x => x.k === ch);
  const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
  const mn = mnemonicFor(it);
  const learned = isLearned(ch), fav = isFav(ch);
  const vocab = (it.vocab || []).map(v =>
    "<li><span class=\"w\" lang=\"ja\">" + esc(v.w) + "</span> <span class=\"r\" lang=\"ja\">" + esc(v.r) + "</span><br>" + esc(v.m) + "</li>").join("") || "<li class=\"explain\">No example words in the data for this kanji yet.</li>";
  const sents = (it.sentences || []).map(s =>
    "<li><div class=\"jp\" lang=\"ja\">" + esc(s.jp) + "</div>" +
    (s.furi ? "<div class=\"ex-furi\" lang=\"ja\">" + s.furi + "</div>" : "") +
    (s.ro ? "<div class=\"r jp\" lang=\"ja\">" + esc(s.ro) + "</div>" : "") +
    (s.en ? "<div class=\"en\" lang=\"en\">" + esc(s.en) + "</div>" : "") + "</li>").join("") ||
    "<li class=\"explain\">No example sentences in the data for this kanji yet.</li>";
  const conf = (it.confusables || []).map(c =>
    DB.byChar[c] ? "<a href=\"#/k/" + encodeURIComponent(c) + "\">" + esc(c) + "</a>" : esc(c)).join(" · ") || "—";
  view.innerHTML =
    "<p><a href=\"#/kanji/" + lv + "\">← " + lv + " browser</a></p>" +
    "<div class=\"detail-head\"><div class=\"kanji-hero\" lang=\"ja\">" + esc(it.k) + "</div>" +
    "<div class=\"detail-title\"><h1><span lang=\"ja\">" + esc(it.k) + "</span> — " + esc(it.meaning) + "</h1>" +
    "<div class=\"readings\">" +
    (it.on.length ? "<span><span class=\"lab\">On </span><span lang=\"ja\">" + esc(it.on.join("、 ")) + "</span></span>" : "") +
    (it.kun.length ? "<span><span class=\"lab\">Kun </span><span lang=\"ja\">" + esc(it.kun.join("、 ")) + "</span></span>" : "") +
    "</div><div class=\"stat-row\">" +
    "<span class=\"badge " + levelClass(lv) + "\">JLPT " + lv + "</span>" +
    (it.strokes ? "<span class=\"badge\">" + it.strokes + " strokes</span>" : "") +
    (it.grade ? "<span class=\"badge\">grade " + it.grade + "</span>" : "") +
    (it.freq ? "<span class=\"badge\">freq #" + it.freq + "</span>" : "") +
    "</div>" +
    "<div class=\"action-row\">" +
    "<button class=\"btn " + (learned ? "good" : "primary") + "\" id=\"dLearn\" aria-pressed=\"" + learned + "\">" + (learned ? "✓ Learned" : "Mark as learned") + "</button>" +
    "<button class=\"btn\" id=\"dFav\" aria-pressed=\"" + fav + "\">" + (fav ? "★ Favorited" : "☆ Favorite") + "</button>" +
    "<a class=\"btn soft\" href=\"#/review?tab=quiz&lv=" + lv + "\">Quiz " + lv + "</a>" +
    "</div></div></div>" +
    "<div class=\"card\" id=\"strokeCard\"><h2>Stroke order" + (it.strokes ? " (" + it.strokes + ")" : "") + "</h2>" +
    "<div class=\"stroke-comp\"><div class=\"stroke-col\"><div class=\"stroke-wrap\"><div class=\"stroke-svg\" id=\"strokeBox\" aria-label=\"Stroke order diagram\"><p class=\"explain\">Loading...</p></div>" +
    "<div class=\"stroke-ctrl\"><button class=\"btn\" id=\"strokePlay\">▶ Play stroke order</button>" +
    "<label class=\"explain\"><input type=\"checkbox\" id=\"strokeNums\" checked> show stroke numbers</label></div></div></div>" +
    "<div class=\"comp-col\"><h3>Components</h3>" +
    "<p class=\"explain\">Structural breakdown (KRADFILE). Badges tell Kangxi radicals apart from plain mnemonic parts.</p>" +
    "<div class=\"comp-list\">" + it.components.map(compRow).join("") + "</div></div></div></div>" +
    "<div class=\"card\"><h2>Mnemonic</h2><p class=\"mnemonic\">" + esc(mn.text) + "</p>" +
    "<p class=\"explain\">" + esc(mn.notice) + " Based on: " + (it.components.map(c => esc(c.c) + " (" + esc(c.m || "?") + ")").join(" + ") || "—") + ".</p></div>" +
    "<div class=\"card\"><h2>Vocabulary</h2><ul class=\"vocab-list\">" + vocab + "</ul>" + vocabLinksForKanji(ch) + "</div>" + grammarLinksForKanji(ch) +
    "<div class=\"card\"><h2>Example sentences</h2><ul class=\"sent-list\">" + sents + "</ul></div>" +
    "<div class=\"card\"><h2>Similar kanji</h2><p class=\"jp\" lang=\"ja\">" + conf + "</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"dNote\" aria-label=\"Personal note\">" + esc(store.notes[ch] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(prev.k) + "\">← " + esc(prev.k) + "</a>" +
    "<a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(next.k) + "\">" + esc(next.k) + " →</a></div>";
  $("#dLearn").addEventListener("click", e => {
    toggleLearned(ch);
    const on = isLearned(ch);
    e.target.textContent = on ? "✓ Learned" : "Mark as learned";
    e.target.setAttribute("aria-pressed", on);
    e.target.className = "btn " + (on ? "good" : "primary");
    renderNav("kanji");
  });
  $("#dFav").addEventListener("click", e => {
    toggleFav(ch);
    const on = isFav(ch);
    e.target.textContent = on ? "★ Favorited" : "☆ Favorite";
    e.target.setAttribute("aria-pressed", on);
  });
  let noteT = null;
  $("#dNote").addEventListener("input", e => {
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      const v = e.target.value.trim();
      if (v) store.notes[ch] = v; else delete store.notes[ch];
      save();
    }, 400);
  });
  initStrokeOrder(it);
}

/* ---------- Stroke order (KanjiVG) ---------- */
let strokeTimers = [];
function stopStrokeTimers() { strokeTimers.forEach(clearTimeout); strokeTimers = []; }
async function initStrokeOrder(it) {
  const box = $("#strokeBox");
  if (!box) return;
  if (!it.hasStroke) {
    box.innerHTML = "<p class=\"explain\">No stroke-order diagram in the data for this kanji.</p>";
    const p = $("#strokePlay"); if (p) p.disabled = true;
    return;
  }
  const svgUrl = STROKE_BASE + it.cp + ".svg";
  let svgText = "";
  let diag = "";
  try {
    const res = await fetch(svgUrl);
    diag += "fetch:s" + res.status + ";";
    if (!res.ok && res.status !== 0) throw new Error("http" + res.status);
    svgText = await res.text();
  } catch (e) {
    diag += "fetchErr:" + (e && e.name ? e.name : "err") + ";";
    try {
      svgText = await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open("GET", svgUrl, true);
        x.onload = () => { diag += "xhr:s" + x.status + ";"; resolve(x.responseText || ""); };
        x.onerror = () => { diag += "xhrErr;"; reject(new Error("xhr")); };
        x.send();
      });
    } catch (e2) { svgText = ""; }
  }
  window.KKDiag = window.KKDiag || {};
  window.KKDiag.stroke = diag + "len" + svgText.length;
  if (!svgText || svgText.indexOf("<svg") < 0) {
    box.innerHTML = "<p class=\"explain\">Could not load the stroke-order diagram. (" + esc(diag + "len" + svgText.length) + ")</p>";
    return;
  }
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) { box.innerHTML = "<p class=\"explain\">Could not parse the diagram.</p>"; return; }
  svg.removeAttribute("width"); svg.removeAttribute("height");
  const strokes = Array.from(svg.querySelectorAll("path")).filter(p => (p.getAttribute("id") || "").indexOf("-s") >= 0);
  strokes.forEach(p => p.classList.add("kvg-stroke"));
  const nums = Array.from(svg.querySelectorAll("text"));
  box.innerHTML = "";
  box.appendChild(svg);
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function play() {
    stopStrokeTimers();
    const lens = strokes.map(p => { try { return p.getTotalLength(); } catch (e) { return 300; } });
    strokes.forEach((p, i) => {
      p.style.transition = "none";
      p.style.strokeDasharray = String(lens[i]);
      p.style.strokeDashoffset = String(lens[i]);
      p.classList.remove("done");
    });
    nums.forEach(t => { t.style.opacity = "0"; });
    if (reduceMotion) {
      strokes.forEach(p => { p.style.strokeDasharray = "none"; p.style.strokeDashoffset = "0"; p.classList.add("done"); });
      nums.forEach(t => { t.style.opacity = "1"; });
      return;
    }
    const per = 450;
    strokes.forEach((p, i) => {
      strokeTimers.push(setTimeout(() => {
        p.style.transition = "stroke-dashoffset " + per + "ms ease";
        p.style.strokeDashoffset = "0";
        if (nums[i]) nums[i].style.opacity = "1";
      }, i * (per + 120)));
    });
    strokeTimers.push(setTimeout(() => strokes.forEach(p => p.classList.add("done")), strokes.length * (per + 120)));
  }
  $("#strokePlay").addEventListener("click", play);
  $("#strokeNums").addEventListener("change", e => {
    nums.forEach(t => { t.style.display = e.target.checked ? "" : "none"; });
  });
  if (store.settings.autoplay) play();
  else { nums.forEach(t => { t.style.opacity = "1"; }); }
}

/* ---------- Helpers ---------- */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ---------- Review: SRS + quiz ---------- */
const SRS_STEPS = [1, 3, 7, 16, 35, 80, 180];
function srsGrade(ch, ok) {
  const s = store.srs[ch] || { box: 0, due: 0 };
  if (ok) {
    s.box = Math.min(SRS_STEPS.length - 1, s.box + 1);
    s.due = Date.now() + SRS_STEPS[s.box] * 864e5;
    store.learned[ch] = store.learned[ch] || Date.now();
  } else {
    s.box = 0;
    s.due = Date.now() + 6e5;
  }
  store.srs[ch] = s;
  save();
}
function dueCards() {
  const now = Date.now();
  return Object.keys(store.srs).filter(k => store.srs[k].due <= now && DB.byChar[k]);
}
function renderReview(view, q) {
  view.innerHTML =
    "<h1>Review</h1>" + "<p class=\"explain\">Kanji quiz &middot; <a href=\"#/review?tab=quiz&kind=vocab\">Vocabulary quiz</a> &middot; <a href=\"#/review?tab=quiz&kind=grammar\">Grammar quiz</a></p>" +
    "<div id=\"revBody\"></div>";
  renderQuiz(document.querySelector("#revBody"), q);
}
function renderQuiz(body, q) {
  const lv = LEVELS.includes((q.lv || "").toUpperCase()) ? q.lv.toUpperCase() : "N5";
  const pool = DB.levels[lv];
  const N = Math.min(10, pool.length);
  const qs = shuffle(pool.slice()).slice(0, N).map((it, n) => {
    const type = n % 3;
    const others = shuffle(pool.filter(x => x.k !== it.k)).slice(0, 3);
    return { it, type, opts: shuffle([it].concat(others)) };
  });
  let i = 0, score = 0, answered = false;
  function draw() {
    if (i >= qs.length) {
      const best = store.quizBest[lv] || 0;
      if (score > best) { store.quizBest[lv] = score; save(); }
      body.innerHTML = "<div class=\"card\"><h2>Quiz result: " + score + " / " + qs.length + "</h2>" +
        "<p class=\"explain\">Best on " + lv + ": " + Math.max(best, score) + " / " + qs.length + "</p>" +
        "<p><button class=\"btn primary\" id=\"qRetry\">Retry</button></p></div>";
      $("#qRetry").addEventListener("click", () => renderQuiz(body, q));
      return;
    }
    const cur = qs[i], it = cur.it;
    const prompt = cur.type === 0
      ? "What does this mean?<span class=\"big\" lang=\"ja\">" + esc(it.k) + "</span>"
      : cur.type === 1
      ? "Which kanji means “" + esc(it.meaning) + "”?"
      : "Which kanji reads “" + esc(it.on[0] || it.kun[0] || "?") + "”?";
    const opts = cur.opts.map(o => {
      const label = cur.type === 0 ? o.meaning : o.k;
      const cls = cur.type === 0 ? "" : " jp";
      return "<button class=\"btn quiz-opt" + cls + "\" data-k=\"" + esc(o.k) + "\"" + (cur.type !== 0 ? " lang=\"ja\"" : "") + ">" + esc(label) + "</button>";
    }).join("");
    body.innerHTML =
      "<p class=\"explain\">" + lv + " quiz · question " + (i + 1) + " of " + qs.length + " · score " + score + "</p>" +
      "<div class=\"card\"><p class=\"quiz-q\">" + prompt + "</p><div class=\"quiz-opts\">" + opts + "</div>" +
      (answered ? "" : "") + "<p id=\"qFb\" class=\"explain\"></p></div>";
    $$(".quiz-opt", body).forEach(b => b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = b.dataset.k === it.k;
      if (ok) { score++; b.classList.add("correct"); $("#qFb").textContent = "Correct! " + it.k + " = " + it.meaning; }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === it.k) x.classList.add("correct"); });
        $("#qFb").innerHTML = "Not quite — <a href=\"#/k/" + encodeURIComponent(it.k) + "\">" + esc(it.k) + "</a> means “" + esc(it.meaning) + "”.";
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next →";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      $("#qFb").after(nx);
    }));
  }
  const lvBtns = LEVELS.map(l => "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const wrap = document.createElement("div");
  wrap.innerHTML = "<div class=\"chip-row\" role=\"group\" aria-label=\"Quiz level\">" + lvBtns + "</div>";
  body.innerHTML = "";
  body.appendChild(wrap);
  const holder = document.createElement("div");
  body.appendChild(holder);
  body = holder;
  $$(".chip", wrap).forEach(c => c.addEventListener("click", () => go("#/review?tab=quiz&lv=" + c.dataset.lv)));
  draw();
}

/* ---------- Search ---------- */
function renderSearch(view, q) {
  const query = q.q || "";
  view.innerHTML =
    "<h1>Search</h1>" +
    "<div class=\"toolbar\"><input type=\"search\" id=\"sq\" placeholder=\"Kanji, word, English meaning, or reading...\" value=\"" + esc(query) + "\" aria-label=\"Search kanji and vocabulary\"></div>" +
    "<div id=\"sRes\"></div>";
  const box = $("#sRes"), input = $("#sq");
  function run() {
    const v = input.value.trim();
    if (!v) { box.innerHTML = "<p class=\"empty\">Try “tree”, “き”, “木”, “mori”... (English, kana, or the character itself).</p>"; return; }
    const out = [];
    const vout = [];
    for (const lid of LEVELS) {
      for (const vv of (DB.vocab[lid] || [])) {
        if (matchVQuery(vv, v)) vout.push(vv);
        if (vout.length >= 120) break;
      }
      if (vout.length >= 120) break;
    }
    for (const lv of LEVELS)
      for (const it of DB.levels[lv]) {
        if (matchQuery({ item: it }, v)) out.push({ item: it, level: lv });
        if (out.length >= 120) break;
      }
    const gout = [];
    for (const lid of LEVELS) {
      for (const gg of (DB.grammar[lid] || [])) {
        if (matchGQuery(gg, v)) gout.push(gg);
        if (gout.length >= 120) break;
      }
      if (gout.length >= 120) break;
    }
    box.innerHTML = "<p class=\"result-count\">" + out.length + (out.length >= 120 ? "+" : "") + " kanji &middot; " + vout.length + (vout.length >= 120 ? "+" : "") + " words &middot; " + gout.length + (gout.length >= 120 ? "+" : "") + " grammar</p>" +
      (out.length ? "<h2>Kanji</h2><div class=\"kanji-grid\">" + out.map(r => kanjiCard(r.item, r.level)).join("") + "</div>" : "") +
      (vout.length ? "<h2>Vocabulary</h2><div class=\"kanji-grid\">" + vout.map(vocabCard).join("") + "</div>" : "") +
      (gout.length ? "<h2>Grammar</h2><div class=\"kanji-grid\">" + gout.map(grammarCard).join("") + "</div>" : "") +
      ((!out.length && !vout.length && !gout.length) ? "<p class=\"empty\">No matches.</p>" : "");
  }
  let deb = null;
  input.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(run, 250); });
  run();
  setTimeout(() => input.focus(), 50);
}

/* ---------- Progress ---------- */
function renderProgress(view) {
  const rows = LEVELS.map(lv => {
    const s = levelStats(lv);
    return "<tr><td><a href=\"#/kanji/" + lv + "\">" + lv + "</a></td><td>" + s.total + "</td>" +
      "<td>" + s.learned + "</td><td>" + s.left + "</td><td style=\"min-width:140px\">" + progressBar(s.pct) + "</td><td>" + s.pct + "%</td></tr>";
  }).join("");
  const tot = LEVELS.reduce((a, lv) => a + levelStats(lv).total, 0);
  const learned = Object.keys(store.learned).length;
  const vTot = LEVELS.reduce((a, lv) => a + vLevelStats(lv).total, 0);
  const vLearned = Object.keys(store.vLearned).length;
  const gTot = LEVELS.reduce((a, lv) => a + gLevelStats(lv).total, 0);
  const gLearned = Object.keys(store.gLearned).length;
  const vrows = LEVELS.map(lv => {
    const s = vLevelStats(lv);
    return "<tr><td><a href=\"#/vocab/" + lv + "\">" + lv + "</a></td><td>" + s.total + "</td>" +
      "<td>" + s.learned + "</td><td>" + s.left + "</td><td style=\"min-width:140px\">" + progressBar(s.pct) + "</td><td>" + s.pct + "%</td></tr>";
  }).join("");
  const grows = LEVELS.map(lv => {
    const s = gLevelStats(lv);
    return "<tr><td><a href=\"#/grammar/" + lv + "\">" + lv + "</a></td><td>" + s.total + "</td>" +
      "<td>" + s.learned + "</td><td>" + s.left + "</td><td style=\"min-width:140px\">" + progressBar(s.pct) + "</td><td>" + s.pct + "%</td></tr>";
  }).join("");
  view.innerHTML =
    "<h1>Progress</h1>" +
    "<div class=\"card\"><h2>Overall</h2>" +
    "<p>" + learned + " / " + tot + " kanji learned &middot; " + vLearned + " / " + vTot + " words learned &middot; " + gLearned + " / " + gTot + " grammar learned · " + dueCount() + " due for review · " +
    (store.fav.length + store.vFav.length + store.gFav.length) + " favorites · " + (Object.keys(store.notes).length + Object.keys(store.vNotes).length + Object.keys(store.gNotes).length) + " notes</p>" +
    progressBar(tot ? Math.round(learned / tot * 100) : 0) + "</div>" +
    "<div class=\"card\"><h2>By level</h2><table class=\"stats\"><tr><th>Level</th><th>Total</th><th>Learned</th><th>Left</th><th></th><th>%</th></tr>" + rows + "</table></div>" +
    "<div class=\"card\"><h2>Vocabulary by level</h2><table class=\"stats\"><tr><th>Level</th><th>Total</th><th>Learned</th><th>Left</th><th></th><th>%</th></tr>" + vrows + "</table></div>" +
    "<div class=\"card\"><h2>Grammar by level</h2><table class=\"stats\"><tr><th>Level</th><th>Total</th><th>Learned</th><th>Left</th><th></th><th>%</th></tr>" + grows + "</table></div>" +
    "<div class=\"card\"><h2>Quiz best scores</h2><p>" +
    LEVELS.map(lv => lv + ": " + (store.quizBest[lv] != null ? store.quizBest[lv] + " / 10" : "—")).join(" · ") + "</p>" +
    "<p>Vocab: " + LEVELS.map(lv => lv + ": " + (store.vQuizBest[lv] != null ? store.vQuizBest[lv] + " / 10" : "-")).join(" | ") + "</p><p>Grammar: " + LEVELS.map(lv => lv + ": " + (store.gQuizBest[lv] != null ? store.gQuizBest[lv] + " / 10" : "-")).join(" | ") + "</p></div>" +
    "<div class=\"card\"><h2>Data</h2><div class=\"settings-row\">" +
    "<button class=\"btn soft\" id=\"pExport\">Export my data</button>" +
    "<button class=\"btn soft\" id=\"pReset\">Reset progress</button></div></div>";
  $("#pExport").addEventListener("click", () => {
    exportBackup();
  });
  $("#pReset").addEventListener("click", () => {
    if (confirm("Reset all progress, favorites, notes and review schedule?")) {
      const theme = store.settings;
      store = defaultStore(); store.settings = theme; save(); render();
    }
  });
}

/* ---------- Settings ---------- */
function renderSettings(view) {
  const s = store.settings;
  view.innerHTML =
    "<h1>Settings</h1>" +
    "<div class=\"card\"><h2>Appearance</h2><div class=\"settings-row\">" +
    "<button class=\"btn\" id=\"sTheme\">Theme: " + esc(s.theme) + "</button></div></div>" +
    "<div class=\"card\"><h2>Stroke order</h2><div class=\"settings-row\">" +
    "<label><input type=\"checkbox\" id=\"sAuto\"" + (s.autoplay ? " checked" : "") + "> Auto-play stroke order</label></div></div>" +
    "<div class=\"card\"><h2>Backup</h2><div class=\"settings-row\">" +
    "<button class=\"btn soft\" id=\"sExport\">Export my data</button>" +
    "<label class=\"btn soft\" for=\"sImport\" style=\"cursor:pointer\">Import backup</label>" +
    "<input type=\"file\" id=\"sImport\" accept=\"application/json\" hidden>" +
    "<button class=\"btn soft\" id=\"sWipe\">Erase everything</button></div>" +
    "<p class=\"explain\">" + storeNote() + "</p></div>" +
    "<div class=\"card\"><h2>About the data</h2>" +
    "<p class=\"explain\">Kanji facts: KANJIDIC2 + curated JLPT files. Components: EDRDG KRADFILE. " +
    "Stroke art: KanjiVG (" + (DB.meta ? LEVELS.map(l => DB.meta.levels[l].stroke + "/" + DB.meta.levels[l].count + " " + l).join(" · ") : "") + "). " +
    "Sentences: Tanaka Corpus + CSV set. Accents: Kanjium. Loader: " + (DB.source || "?") + ". Vocab: JLPT lists (" + (DB.vocabMeta ? DB.vocabMeta.total : vAll().length) + " words) + Tatoeba sentences (" + (DB.vocabMeta ? DB.vocabMeta.withSentences : 0) + " with matches). Grammar: Anki deck ‘Japanese Core Grammar JLPT N5-N1’ (" + (DB.grammarMeta ? DB.grammarMeta.total : gAll().length) + " points, text only, no audio used, no licence stated). Full credits in resources/CREDITS.md.</p></div>" +
    "<div class=\"card\"><h2>About this app</h2>" +
    "<p class=\"explain\">KnowKanji " + (window.APP_VERSION || "1.0.0") + " runs fully offline: all kanji, vocabulary and grammar data (incl. example sentences) plus stroke diagrams are bundled, with no account or network needed. Sources: KANJIDIC2, KRADFILE (EDRDG), KanjiVG, Tanaka Corpus, Kanjium. See resources/CREDITS.md for full attribution.</p></div>";
  $("#sTheme").addEventListener("click", e => {
    s.theme = s.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
    e.target.textContent = "Theme: " + s.theme;
  });
  $("#sAuto").addEventListener("change", e => { s.autoplay = e.target.checked; save(); });
  $("#sExport").addEventListener("click", () => {
    exportBackup();
  });
  $("#sImport").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data && typeof data === "object") {
          store = Object.assign(defaultStore(), data); save(); applyTheme(); render();
          alert("Backup imported.");
        } else alert("That file does not look like a KnowKanji backup.");
      } catch (err) { alert("Could not read that file."); }
    };
    r.readAsText(f);
  });
  $("#sWipe").addEventListener("click", () => {
    if (confirm("Erase ALL data including settings?")) {
      store = defaultStore(); save(); applyTheme(); render();
    }
  });
}

﻿/* ---------- Vocabulary (JLPT N5..N1, Tatoeba example sentences) ----------
   Data: data/vocab_n5..n1.json + data/vocab_meta.json (see scripts/build_vocab.py).
   Sentences are pre-matched at build time by exact-substring search of the
   vocab surface form (kanji form preferred, kana-only only when len>=3);
   see build_vocab.py. Unmatched items keep sentences=[] (never invented). */
function vAll() {
  const out = [];
  for (const lv of LEVELS) for (const v of (DB.vocab[lv] || [])) out.push(v);
  return out;
}
function vById(id) { return DB.vById[id] || null; }
function isVLearned(id) { return !!store.vLearned[id]; }
function isVFav(id) { return store.vFav.indexOf(id) !== -1; }
function vStatusDot(id) {
  if (isVLearned(id)) return "<span class=\"dot learned\" title=\"Learned\"></span>";
  if (store.vSrs[id]) return "<span class=\"dot learning\" title=\"Learning\"></span>";
  return "<span class=\"dot\" title=\"Not started\"></span>";
}
function vLevelStats(lv) {
  const items = DB.vocab[lv] || [];
  let learned = 0;
  for (const v of items) if (store.vLearned[v.id]) learned++;
  return { total: items.length, learned, left: items.length - learned,
    pct: items.length ? Math.round(learned / items.length * 100) : 0 };
}
function vDueCount() {
  const now = Date.now();
  let n = 0;
  for (const k of Object.keys(store.vSrs || {})) {
    if (store.vSrs[k].due <= now && DB.vById[k]) n++;
  }
  return n;
}
function vDueCards() {
  const now = Date.now();
  return Object.keys(store.vSrs || {}).filter(k => store.vSrs[k].due <= now && DB.vById[k]);
}
function vSrsGrade(id, ok) {
  const s = store.vSrs[id] || { box: 0, due: 0 };
  if (ok) {
    s.box = Math.min(SRS_STEPS.length - 1, s.box + 1);
    s.due = Date.now() + SRS_STEPS[s.box] * 864e5;
    store.vLearned[id] = store.vLearned[id] || Date.now();
  } else {
    s.box = 0;
    s.due = Date.now() + 6e5;
  }
  store.vSrs[id] = s;
  save();
}
function toggleVLearned(id) {
  if (store.vLearned[id]) {
    delete store.vLearned[id];
  } else {
    store.vLearned[id] = Date.now();
    if (!store.vSrs[id]) store.vSrs[id] = { box: 1, due: Date.now() + 864e5 };
  }
  save();
}
function toggleVFav(id) {
  const i = store.vFav.indexOf(id);
  if (i >= 0) store.vFav.splice(i, 1); else store.vFav.push(id);
  save();
}
function kanjiCharsOf(v) {
  const out = [];
  const s = v.word || "";
  for (const ch of s) {
    if (DB.byChar[ch] && out.indexOf(ch) < 0) out.push(ch);
  }
  return out;
}
function vocabForKanji(ch, limit) {
  const out = [];
  for (const lv of LEVELS) {
    for (const v of (DB.vocab[lv] || [])) {
      if ((v.word || "").indexOf(ch) >= 0) {
        out.push(v);
        if (out.length >= (limit || 12)) return out;
      }
    }
  }
  return out;
}
function matchVQuery(v, q) {
  if (!q) return true;
  const t = String(q).trim();
  if (!t) return true;
  if (v.word === t) return true;
  const f = foldEnglish(t);
  if (f) {
    if (foldEnglish(v.meaning).indexOf(f) >= 0) return true;
    if ((v.meanings || []).some(m => foldEnglish(m).indexOf(f) >= 0)) return true;
  }
  const rq = foldReading(t);
  if (rq) {
    if (foldReading(v.reading).indexOf(rq) >= 0) return true;
    if (foldReading(v.word).indexOf(rq) >= 0) return true;
  }
  return false;
}
function vocabCard(v) {
  const fav = isVFav(v.id) ? "<span class=\"fav-star\" aria-label=\"Favorite\">*</span>" : "";
  return "<a class=\"kcard vcard\" href=\"#/v/" + encodeURIComponent(v.id) + "\">" + fav +
    "<span class=\"vword jp\" lang=\"ja\">" + esc(v.word) + "</span>" +
    "<span class=\"read\" lang=\"ja\">" + esc(v.reading) + "</span>" +
    "<span class=\"mean\">" + esc(v.meaning) + "</span>" +
    "<span class=\"meta\"><span class=\"badge " + levelClass(v.jlpt) + "\">" + v.jlpt + "</span>" + vStatusDot(v.id) + "</span></a>";
}
function renderVocabHome(view) {
  const due = vDueCount();
  const cards = LEVELS.map(lv => {
    const s = vLevelStats(lv);
    return "<a class=\"level-card\" href=\"#/vocab/" + lv + "\">" +
      "<div class=\"lvl\">JLPT <span lang=\"en\">" + lv + "</span> <small>" + s.total + " words</small></div>" +
      "<div class=\"count\">" + s.learned + " / " + s.total + " learned</div>" +
      progressBar(s.pct) + "<div class=\"progress-label\">" + s.pct + "% complete · " + s.left + " left</div></a>";
  }).join("");
  const total = DB.vocabMeta ? DB.vocabMeta.total : vAll().length;
  view.innerHTML =
    "<h1>JLPT vocabulary</h1>" +
    "<p class=\"lead\">Learn the words behind the kanji. " + total + " words across N5 to N1, each with reading, meaning and real Tatoeba example sentences — all offline.</p>" +
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/review?tab=quiz&kind=vocab\">Practice now — " + due + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<div class=\"card\"><h2>How vocab review works</h2>" +
    "<p class=\"explain\">Browse a level, open a word to see its kanji links and example sentences, mark it learned, then lock it in with quizzes. Words you favorite or annotate sync into the same backup as your kanji progress.</p>" +
    "<p><a class=\"btn\" href=\"#/vocab/N5\">Browse N5 words</a> <a class=\"btn soft\" href=\"#/search?q=\">Search words</a></p></div>";
}
function renderVocabBrowse(view, level, q) {
  const lv = LEVELS.includes((level || "").toUpperCase()) ? level.toUpperCase() : "N5";
  const query = q.q || "", filt = q.f || "all", sort = q.s || "default";
  const link = (over) => "#/vocab/" + lv + "?" + new URLSearchParams(Object.assign({ q: query, f: filt, s: sort }, over)).toString();
  let recs = (DB.vocab[lv] || []).slice();
  recs = recs.filter(v => matchVQuery(v, query));
  if (filt === "learned") recs = recs.filter(v => isVLearned(v.id));
  else if (filt === "unlearned") recs = recs.filter(v => !isVLearned(v.id));
  else if (filt === "fav") recs = recs.filter(v => isVFav(v.id));
  else if (filt === "nosent") recs = recs.filter(v => !(v.sentences && v.sentences.length));
  if (sort === "alpha") recs.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
  else if (sort === "reading") recs.sort((a, b) => (a.reading < b.reading ? -1 : 1));
  else if (sort === "progress") recs.sort((a, b) => ((store.vLearned[a.id] ? 1 : 0) - (store.vLearned[b.id] ? 1 : 0)));
  const chips = LEVELS.map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(vocabCard).join("") :
    "<p class=\"empty\">No words match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Vocabulary " + lv + "</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"vq\" placeholder=\"Search word, reading, meaning...\" value=\"" + esc(query) + "\" aria-label=\"Search vocabulary\">" +
    "<select id=\"vf\" aria-label=\"Filter\">" +
    "<option value=\"all\"" + (filt === "all" ? " selected" : "") + ">All</option>" +
    "<option value=\"learned\"" + (filt === "learned" ? " selected" : "") + ">Learned</option>" +
    "<option value=\"unlearned\"" + (filt === "unlearned" ? " selected" : "") + ">Unlearned</option>" +
    "<option value=\"fav\"" + (filt === "fav" ? " selected" : "") + ">Favorites</option>" +
    "<option value=\"nosent\"" + (filt === "nosent" ? " selected" : "") + ">No sentence yet</option>" +
    "</select>" +
    "<select id=\"vs\" aria-label=\"Sort\">" +
    "<option value=\"default\"" + (sort === "default" ? " selected" : "") + ">Default</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">A-Z</option>" +
    "<option value=\"reading\"" + (sort === "reading" ? " selected" : "") + ">Reading</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option>" +
    "</select></div>" +
    "<p class=\"result-count\">" + recs.length + " words · <a href=\"#/review?tab=quiz&kind=vocab&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
    "<div class=\"kanji-grid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/vocab/" + c.dataset.lv + "?" + new URLSearchParams({ q: query, f: filt, s: sort }).toString())));
  let deb = null;
  $("#vq").addEventListener("input", e => {
    clearTimeout(deb);
    deb = setTimeout(() => go(link({ q: e.target.value })), 350);
  });
  $("#vf").addEventListener("change", e => go(link({ f: e.target.value })));
  $("#vs").addEventListener("change", e => go(link({ s: e.target.value })));
}
function renderVocabDetail(view, id) {
  const v = vById(id);
  if (!v) { view.innerHTML = "<p class=\"empty\">Word not found. <a href=\"#/vocab\">Back to vocabulary</a></p>"; return; }
  const list = DB.vocab[v.jlpt] || [];
  const idx = list.findIndex(x => x.id === id);
  const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
  const learned = isVLearned(id), fav = isVFav(id);
  const klinks = kanjiCharsOf(v).map(ch =>
    "<a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(ch) + "\" lang=\"ja\">" + esc(ch) + "</a>").join(" ") || "<span class=\"explain\">No kanji links — kana word.</span>";
  const sents = (v.sentences || []).map(s =>
    "<li><div class=\"jp\" lang=\"ja\">" + esc(s.jp) + "</div>" +
    (s.furi ? "<div class=\"ex-furi\" lang=\"ja\">" + s.furi + "</div>" : "") +
    "<div class=\"en\" lang=\"en\">" + esc(s.en) + "</div></li>").join("") ||
    "<li class=\"explain\">No Tatoeba example sentence matched this word yet. The word itself is still fully searchable and reviewable.</li>";
  const meanings = (v.meanings || []).map(esc).join("; ");
  view.innerHTML =
    "<p><a href=\"#/vocab/" + v.jlpt + "\">← " + v.jlpt + " vocabulary</a></p>" +
    "<div class=\"detail-head\"><div class=\"kanji-hero vocab-hero\" lang=\"ja\">" + esc(v.word) + "</div>" +
    "<div class=\"detail-title\"><h1><span lang=\"ja\">" + esc(v.word) + "</span></h1>" +
    "<div class=\"readings\"><span><span class=\"lab\">Reading </span><span lang=\"ja\">" + esc(v.reading) + "</span></span></div>" +
    "<p class=\"lead\" style=\"margin:.4rem 0\">" + esc(v.meaning) + "</p>" +
    "<div class=\"stat-row\">" +
    "<span class=\"badge " + levelClass(v.jlpt) + "\">JLPT " + v.jlpt + "</span>" +
    "<span class=\"badge\">JMdict #" + esc(v.seq) + "</span>" +
    "</div>" +
    "<div class=\"action-row\">" +
    "<button class=\"btn " + (learned ? "good\" aria-pressed=\"true" : "primary\" aria-pressed=\"false") + "\" id=\"vLearn\">" + (learned ? "Learned" : "Mark as learned") + "</button>" +
    "<button class=\"btn\" id=\"vFav\" aria-pressed=\"" + fav + "\">" + (fav ? "Favorited" : "Favorite") + "</button>" +
    "<a class=\"btn soft\" href=\"#/review?tab=quiz&kind=vocab&lv=" + v.jlpt + "\">Quiz " + v.jlpt + "</a>" +
    "</div></div></div>" +
    "<div class=\"card\"><h2>Meanings</h2><p>" + meanings + "</p>" +
    "<h2>Kanji in this word</h2><p>" + klinks + "</p>" +
    "<p class=\"explain\">Tap a kanji to open its stroke order, components and mnemonic.</p></div>" +
    "<div class=\"card\"><h2>Example sentences</h2><ul class=\"sent-list\">" + sents + "</ul>" +
    "<p class=\"explain\">Sentences: Tatoeba JP-EN pairs matched by exact word occurrence at build time (CC BY 2.0 FR). Shortest matches kept; quality varies.</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"vNote\" aria-label=\"Personal note\">" + esc(store.vNotes[id] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/v/" + encodeURIComponent(prev.id) + "\">← " + esc(prev.word) + "</a>" +
    "<a class=\"btn soft\" href=\"#/v/" + encodeURIComponent(next.id) + "\">" + esc(next.word) + " →</a></div>";
  $("#vLearn").addEventListener("click", e => {
    toggleVLearned(id);
    const on = isVLearned(id);
    e.target.textContent = on ? "Learned" : "Mark as learned";
    e.target.setAttribute("aria-pressed", on);
    e.target.className = "btn " + (on ? "good" : "primary");
    renderNav("vocab");
  });
  $("#vFav").addEventListener("click", e => {
    toggleVFav(id);
    const on = isVFav(id);
    e.target.textContent = on ? "Favorited" : "Favorite";
    e.target.setAttribute("aria-pressed", on);
  });
  let noteT = null;
  $("#vNote").addEventListener("input", e => {
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      const val = e.target.value.trim();
      if (val) store.vNotes[id] = val; else delete store.vNotes[id];
      save();
    }, 400);
  });
}
function renderVReview(view, q) {
  view.innerHTML =
    "<h1>Vocab review</h1>" +
    "<p class=\"explain\"><a href=\"#/review\">Kanji quiz</a> · Vocabulary quiz &middot; <a href=\"#/review?tab=quiz&kind=grammar\">Grammar quiz</a></p>" +
    "<div id=\"revBody\"></div>";
  renderVQuiz(document.querySelector("#revBody"), q);
}
function renderVQuiz(body, q) {
  const lv = LEVELS.includes((q.lv || "").toUpperCase()) ? q.lv.toUpperCase() : "N5";
  const pool = DB.vocab[lv] || [];
  const N = Math.min(10, pool.length);
  const qs = shuffle(pool.slice()).slice(0, N).map((v, n) => {
    const type = n % 3;
    const others = shuffle(pool.filter(x => x.id !== v.id)).slice(0, 3);
    return { v, type, opts: shuffle([v].concat(others)) };
  });
  let i = 0, score = 0, answered = false;
  function draw() {
    if (i >= qs.length) {
      const best = (store.vQuizBest || {})[lv] || 0;
      if (score > best) { store.vQuizBest[lv] = score; save(); }
      body.innerHTML = "<div class=\"card\"><h2>Quiz result: " + score + " / " + qs.length + "</h2>" +
        "<p class=\"explain\">Best vocab " + lv + ": " + Math.max(best, score) + " / " + qs.length + "</p>" +
        "<p><button class=\"btn primary\" id=\"qRetry\">Retry</button></p></div>";
      $("#qRetry").addEventListener("click", () => renderVQuiz(body, q));
      return;
    }
    const cur = qs[i], v = cur.v;
    const prompt = cur.type === 0
      ? "What does this mean?<span class=\"big jp\" lang=\"ja\">" + esc(v.word) + "</span>"
      : cur.type === 1
      ? "Which word means: " + esc(v.meaning) + "?"
      : "Which word reads: <span lang=\"ja\">" + esc(v.reading) + "</span>?";
    const opts = cur.opts.map(o => {
      const label = cur.type === 0 ? o.meaning : (cur.type === 1 ? o.word : o.word);
      const cls = cur.type === 0 ? "" : " jp";
      return "<button class=\"btn quiz-opt" + cls + "\" data-k=\"" + esc(o.id) + "\"" + (cur.type !== 0 ? " lang=\"ja\"" : "") + ">" + esc(label) + "</button>";
    }).join("");
    body.innerHTML =
      "<p class=\"explain\">" + lv + " vocab quiz · question " + (i + 1) + " of " + qs.length + " · score " + score + "</p>" +
      "<div class=\"card\"><p class=\"quiz-q\">" + prompt + "</p><div class=\"quiz-opts\">" + opts + "</div>" +
      "<p id=\"qFb\" class=\"explain\"></p></div>";
    $$(".quiz-opt", body).forEach(b => b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = b.dataset.k === v.id;
      if (ok) { score++; b.classList.add("correct"); $("#qFb").textContent = "Correct! " + v.word + " = " + v.meaning; }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === v.id) x.classList.add("correct"); });
        $("#qFb").innerHTML = "Not quite — <a href=\"#/v/" + encodeURIComponent(v.id) + "\">" + esc(v.word) + "</a> means " + esc(v.meaning) + ".";
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      $("#qFb").after(nx);
    }));
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = "<div class=\"chip-row\" role=\"group\" aria-label=\"Quiz level\">" + LEVELS.map(l => "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("") + "</div>";
  body.innerHTML = "";
  body.appendChild(wrap);
  const holder = document.createElement("div");
  body.appendChild(holder);
  body = holder;
  $$(".chip", wrap).forEach(c => c.addEventListener("click", () => go("#/review?tab=quiz&kind=vocab&lv=" + c.dataset.lv)));
  draw();
}
function vocabLinksForKanji(ch) {
  try {
    const rel = vocabForKanji(ch, 12);
    if (!rel.length) return "";
    return "<p class=\"explain\">JLPT vocabulary with this kanji:</p><p>" + rel.map(v => "<a class=\"btn soft\" style=\"margin:.15rem\" href=\"#/v/" + encodeURIComponent(v.id) + "\" lang=\"ja\">" + esc(v.word) + "</a>").join(" ") + "</p><p><a href=\"#/search?q=" + encodeURIComponent(ch) + "\">Search all words with " + esc(ch) + "</a></p>";
  } catch (e) { return ""; }
}

/* ---------- Grammar ---------- */
function gAll() {
  const out = [];
  for (const lv of LEVELS) for (const g of (DB.grammar[lv] || [])) out.push(g);
  return out;
}
function gById(id) { return DB.gById[id] || null; }
function gIdByPoint(point) {
  for (const lv of LEVELS) for (const g of (DB.grammar[lv] || [])) if (g.point === point) return g.id;
  return null;
}
function isGLearned(id) { return !!store.gLearned[id]; }
function isGFav(id) { return store.gFav.indexOf(id) !== -1; }
function gStatusDot(id) {
  if (isGLearned(id)) return "<span class=\"dot learned\" title=\"Learned\"></span>";
  if (store.gSrs[id]) return "<span class=\"dot learning\" title=\"Learning\"></span>";
  return "<span class=\"dot\" title=\"Not started\"></span>";
}
function gLevelStats(lv) {
  const items = DB.grammar[lv] || [];
  let learned = 0;
  for (const g of items) if (store.gLearned[g.id]) learned++;
  return { total: items.length, learned, left: items.length - learned,
    pct: items.length ? Math.round(learned / items.length * 100) : 0 };
}
function gDueCount() {
  const now = Date.now();
  let n = 0;
  for (const k of Object.keys(store.gSrs || {})) {
    if (store.gSrs[k].due <= now && DB.gById[k]) n++;
  }
  return n;
}
function gDueCards() {
  const now = Date.now();
  return Object.keys(store.gSrs || {}).filter(k => store.gSrs[k].due <= now && DB.gById[k]);
}
function gSrsGrade(id, ok) {
  const s = store.gSrs[id] || { box: 0, due: 0 };
  if (ok) {
    s.box = Math.min(SRS_STEPS.length - 1, s.box + 1);
    s.due = Date.now() + SRS_STEPS[s.box] * 864e5;
    store.gLearned[id] = store.gLearned[id] || Date.now();
  } else {
    s.box = 0;
    s.due = Date.now() + 6e5;
  }
  store.gSrs[id] = s;
  save();
}
function toggleGLearned(id) {
  if (store.gLearned[id]) {
    delete store.gLearned[id];
  } else {
    store.gLearned[id] = Date.now();
    if (!store.gSrs[id]) store.gSrs[id] = { box: 1, due: Date.now() + 864e5 };
  }
  save();
}
function toggleGFav(id) {
  const i = store.gFav.indexOf(id);
  if (i >= 0) store.gFav.splice(i, 1); else store.gFav.push(id);
  save();
}
function stripTags(s) { return String(s || "").replace(/<[^<>]*>/g, " "); }
function matchGQuery(g, q) {
  if (!q) return true;
  const t = String(q).trim();
  if (!t) return true;
  if (g.point === t) return true;
  if ((g.point || "").indexOf(t) >= 0) return true;
  const f = foldEnglish(t);
  if (f) {
    if (foldEnglish(g.meaning).indexOf(f) >= 0) return true;
    const secText = foldEnglish(stripTags((g.sections || []).map(s => s.html).join(" ")));
    if (secText.indexOf(f) >= 0) return true;
    for (const e of (g.examples || [])) {
      if (foldEnglish(e.en).indexOf(f) >= 0) return true;
    }
  }
  for (const e of (g.examples || [])) {
    if ((e.jp || "").indexOf(t) >= 0) return true;
  }
  return false;
}
function grammarCard(g) {
  const fav = isGFav(g.id) ? "<span class=\"fav-star\" aria-label=\"Favorite\">&#9733;</span>" : "";
  return "<a class=\"kcard gcard\" href=\"#/g/" + encodeURIComponent(g.id) + "\">" + fav +
    "<span class=\"gpoint jp\" lang=\"ja\">" + esc(g.point) + "</span>" +
    "<span class=\"mean\">" + esc(g.meaning) + "</span>" +
    "<span class=\"meta\"><span class=\"badge " + levelClass(g.jlpt) + "\">" + g.jlpt + "</span>" + gStatusDot(g.id) + "</span></a>";
}
function renderGrammarHome(view) {
  const due = gDueCount();
  const cards = LEVELS.map(lv => {
    const s = gLevelStats(lv);
    return "<a class=\"level-card\" href=\"#/grammar/" + lv + "\">" +
      "<div class=\"lvl\">JLPT <span lang=\"en\">" + lv + "</span> <small>" + s.total + " points</small></div>" +
      "<div class=\"count\">" + s.learned + " / " + s.total + " learned</div>" +
      progressBar(s.pct) + "<div class=\"progress-label\">" + s.pct + "% complete &middot; " + s.left + " left</div></a>";
  }).join("");
  const total = DB.grammarMeta ? DB.grammarMeta.total : gAll().length;
  view.innerHTML =
    "<h1>JLPT grammar</h1>" +
    "<p class=\"lead\">Master the patterns behind the sentences. " + total + " grammar points across N5 to N1, each with a plain-English meaning, formation notes and real example sentences with readings &mdash; all offline.</p>" +
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/review?tab=quiz&kind=grammar\">Practice now &mdash; " + due + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<div class=\"card\"><h2>How grammar review works</h2>" +
    "<p class=\"explain\">Browse a level, open a point to see its explanation, formation and examples (tap to reveal translations), mark it learned, then lock it in with quizzes. Points you favorite or annotate sync into the same backup as your kanji and vocabulary progress.</p>" +
    "<p><a class=\"btn\" href=\"#/grammar/N5\">Browse N5 grammar</a> <a class=\"btn soft\" href=\"#/search?q=\">Search grammar</a></p></div>";
}
function renderGrammarBrowse(view, level, q) {
  const lv = LEVELS.includes((level || "").toUpperCase()) ? level.toUpperCase() : "N5";
  const query = q.q || "", filt = q.f || "all", sort = q.s || "default";
  const link = (over) => "#/grammar/" + lv + "?" + new URLSearchParams(Object.assign({ q: query, f: filt, s: sort }, over)).toString();
  let recs = (DB.grammar[lv] || []).slice();
  recs = recs.filter(g => matchGQuery(g, query));
  if (filt === "learned") recs = recs.filter(g => isGLearned(g.id));
  else if (filt === "unlearned") recs = recs.filter(g => !isGLearned(g.id));
  else if (filt === "fav") recs = recs.filter(g => isGFav(g.id));
  if (sort === "alpha") recs.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
  else if (sort === "progress") recs.sort((a, b) => ((store.gLearned[a.id] ? 1 : 0) - (store.gLearned[b.id] ? 1 : 0)));
  const chips = LEVELS.map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(grammarCard).join("") :
    "<p class=\"empty\">No grammar points match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Grammar " + lv + "</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"gq\" placeholder=\"Search point, meaning, example...\" value=\"" + esc(query) + "\" aria-label=\"Search grammar\">" +
    "<select id=\"gf\" aria-label=\"Filter\">" +
    "<option value=\"all\"" + (filt === "all" ? " selected" : "") + ">All</option>" +
    "<option value=\"learned\"" + (filt === "learned" ? " selected" : "") + ">Learned</option>" +
    "<option value=\"unlearned\"" + (filt === "unlearned" ? " selected" : "") + ">Unlearned</option>" +
    "<option value=\"fav\"" + (filt === "fav" ? " selected" : "") + ">Favorites</option>" +
    "</select>" +
    "<select id=\"gs\" aria-label=\"Sort\">" +
    "<option value=\"default\"" + (sort === "default" ? " selected" : "") + ">Default</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">A-Z</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option>" +
    "</select></div>" +
    "<p class=\"result-count\">" + recs.length + " points &middot; <a href=\"#/review?tab=quiz&kind=grammar&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
    "<div class=\"kanji-grid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/grammar/" + c.dataset.lv + "?" + new URLSearchParams({ q: query, f: filt, s: sort }).toString())));
  let deb = null;
  $("#gq").addEventListener("input", e => {
    clearTimeout(deb);
    deb = setTimeout(() => go(link({ q: e.target.value })), 350);
  });
  $("#gf").addEventListener("change", e => go(link({ f: e.target.value })));
  $("#gs").addEventListener("change", e => go(link({ s: e.target.value })));
}
function kanjiCharsIn(text) {
  const out = [];
  for (const ch of String(text || "")) {
    if (DB.byChar[ch] && out.indexOf(ch) < 0) out.push(ch);
  }
  return out;
}
function vocabForExample(jp, limit) {
  const out = [];
  for (const v of vAll()) {
    if ((v.word || "").length >= 2 && jp.indexOf(v.word) >= 0 && out.indexOf(v) < 0) {
      out.push(v);
      if (out.length >= (limit || 6)) break;
    }
  }
  return out;
}
function grammarLinksForKanji(ch) {
  try {
    const rel = [];
    for (const lv of LEVELS) {
      for (const g of (DB.grammar[lv] || [])) {
        if ((g.point || "").indexOf(ch) >= 0 || (g.examples || []).some(e => (e.jp || "").indexOf(ch) >= 0)) {
          rel.push(g);
          if (rel.length >= 8) break;
        }
      }
      if (rel.length >= 8) break;
    }
    if (!rel.length) return "";
    return "<div class=\"card\"><h2>Grammar with this kanji</h2><p>" +
      rel.map(g => "<a class=\"btn soft\" style=\"margin:.15rem\" href=\"#/g/" + encodeURIComponent(g.id) + "\" lang=\"ja\">" + esc(g.point) + "</a>").join(" ") +
      "</p><p><a href=\"#/search?q=" + encodeURIComponent(ch) + "\">Search everything with " + esc(ch) + "</a></p></div>";
  } catch (e) { return ""; }
}
function renderGrammarDetail(view, id) {
  const g = gById(id);
  if (!g) { view.innerHTML = "<p class=\"empty\">Grammar point not found. <a href=\"#/grammar\">Back to grammar</a></p>"; return; }
  const list = DB.grammar[g.jlpt] || [];
  const idx = list.findIndex(x => x.id === id);
  const prev = list[(idx - 1 + list.length) % list.length], next = list[(idx + 1) % list.length];
  const learned = isGLearned(id), fav = isGFav(id);
  const secs = (g.sections || []).filter(s => s.label.toLowerCase() !== "meaning").map(s =>
    "<h3 class=\"gsec\">" + esc(s.label) + "</h3><p>" + s.html + "</p>").join("");
  const exHtml = (g.examples || []).map(e =>
    "<li><div class=\"jp ex-jp\" lang=\"ja\">" + esc(e.jp) + "</div>" +
    (e.furi ? "<div class=\"ex-furi\" lang=\"ja\">" + e.furi + "</div>" : "") +
    (e.en ? "<details class=\"trans\"><summary>Show translation</summary><div class=\"en\" lang=\"en\">" + esc(e.en) + "</div></details>" : "") +
    "</li>").join("") || "<li class=\"explain\">No example sentences for this point yet.</li>";
  const allJp = (g.examples || []).map(e => e.jp).join(" ");
  const klinks = kanjiCharsIn(g.point + " " + allJp).slice(0, 12).map(ch =>
    "<a class=\"btn soft\" style=\"margin:.15rem\" href=\"#/k/" + encodeURIComponent(ch) + "\" lang=\"ja\">" + esc(ch) + "</a>").join(" ") ||
    "<span class=\"explain\">No kanji links &mdash; kana-only point.</span>";
  const vlinks = vocabForExample(allJp, 6).map(v =>
    "<a class=\"btn soft\" style=\"margin:.15rem\" href=\"#/v/" + encodeURIComponent(v.id) + "\" lang=\"ja\">" + esc(v.word) + "</a>").join(" ") ||
    "<span class=\"explain\">No vocabulary links.</span>";
  const rel = (g.related || []).map(p => {
    const rid = gIdByPoint(p);
    return rid ? "<a class=\"btn soft\" style=\"margin:.15rem\" href=\"#/g/" + encodeURIComponent(rid) + "\" lang=\"ja\">" + esc(p) + "</a>" : "";
  }).join("");
  view.innerHTML =
    "<p><a href=\"#/grammar/" + g.jlpt + "\">&larr; " + g.jlpt + " grammar</a></p>" +
    "<div class=\"detail-head\"><div class=\"kanji-hero gram-hero\" lang=\"ja\">" + esc(g.point) + "</div>" +
    "<div class=\"detail-title\"><h1><span lang=\"ja\">" + esc(g.point) + "</span></h1>" +
    "<p class=\"lead\" style=\"margin:.4rem 0\">" + esc(g.meaning) + "</p>" +
    "<div class=\"stat-row\">" +
    "<span class=\"badge " + levelClass(g.jlpt) + "\">JLPT " + g.jlpt + "</span>" +
    (g.frequency ? "<span class=\"badge\">" + esc(g.frequency) + "</span>" : "") +
    "</div>" +
    "<div class=\"action-row\">" +
    "<button class=\"btn " + (learned ? "good\" aria-pressed=\"true" : "primary\" aria-pressed=\"false") + "\" id=\"gLearn\">" + (learned ? "Learned" : "Mark as learned") + "</button>" +
    "<button class=\"btn\" id=\"gFav\" aria-pressed=\"" + fav + "\">" + (fav ? "Favorited" : "Favorite") + "</button>" +
    "<a class=\"btn soft\" href=\"#/review?tab=quiz&kind=grammar&lv=" + g.jlpt + "\">Quiz " + g.jlpt + "</a>" +
    "</div></div></div>" +
    (secs ? "<div class=\"card\"><h2>Explanation</h2>" + secs + "</div>" : "") +
    "<div class=\"card\"><h2>Examples</h2><ul class=\"sent-list\">" + exHtml + "</ul>" +
    "<p class=\"explain\">Examples: Anki deck &lsquo;Japanese Core Grammar JLPT N5-N1&rsquo; (text only, no audio). Tap a translation to reveal it.</p></div>" +
    (rel ? "<div class=\"card\"><h2>Related grammar</h2><p>" + rel + "</p></div>" : "") +
    "<div class=\"card\"><h2>Kanji in these examples</h2><p>" + klinks + "</p>" +
    "<h2>Vocabulary in these examples</h2><p>" + vlinks + "</p>" +
    "<p class=\"explain\">Tap a kanji or word to open it.</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"gNote\" aria-label=\"Personal note\">" + esc(store.gNotes[id] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/g/" + encodeURIComponent(prev.id) + "\">&larr; " + esc(prev.point) + "</a>" +
    "<a class=\"btn soft\" href=\"#/g/" + encodeURIComponent(next.id) + "\">" + esc(next.point) + " &rarr;</a></div>";
  $("#gLearn").addEventListener("click", e => {
    toggleGLearned(id);
    const on = isGLearned(id);
    e.target.textContent = on ? "Learned" : "Mark as learned";
    e.target.setAttribute("aria-pressed", on);
    e.target.className = "btn " + (on ? "good" : "primary");
    renderNav("grammar");
  });
  $("#gFav").addEventListener("click", e => {
    toggleGFav(id);
    const on = isGFav(id);
    e.target.textContent = on ? "Favorited" : "Favorite";
    e.target.setAttribute("aria-pressed", on);
  });
  let noteT = null;
  $("#gNote").addEventListener("input", e => {
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      const val = e.target.value.trim();
      if (val) store.gNotes[id] = val; else delete store.gNotes[id];
      save();
    }, 400);
  });
}
function renderGReview(view, q) {
  view.innerHTML =
    "<h1>Grammar review</h1>" +
    "<p class=\"explain\"><a href=\"#/review\">Kanji quiz</a> &middot; <a href=\"#/review?tab=quiz&kind=vocab\">Vocabulary quiz</a> &middot; Grammar quiz</p>" +
    "<div id=\"revBody\"></div>";
  renderGQuiz(document.querySelector("#revBody"), q);
}
function blankForm(g) {
  const base = String(g.point || "").replace(/^\u301c/, "");
  if (!base) return null;
  for (const e of (g.examples || [])) {
    const jp = e.jp || "";
    const i = jp.indexOf(base);
    if (i >= 0) return { ex: e, blanked: jp.slice(0, i) + "＿＿" + jp.slice(i + base.length) };
  }
  return null;
}
function gQuizLabelT(o) { return ((o.examples || [])[0] || {}).en || o.meaning; }
function pickGQuizOpts(pool, self, labelFn) {
  const seen = {};
  seen[labelFn(self)] = 1;
  const opts = [self];
  for (const o of shuffle(pool.slice())) {
    if (o.id === self.id) continue;
    const l = labelFn(o);
    if (!l || seen[l]) continue;
    seen[l] = 1;
    opts.push(o);
    if (opts.length >= 4) break;
  }
  return shuffle(opts);
}
function renderGQuiz(body, q) {
  const lv = LEVELS.includes((q.lv || "").toUpperCase()) ? q.lv.toUpperCase() : "N5";
  const pool = DB.grammar[lv] || [];
  const N = Math.min(10, pool.length);
  const qs = shuffle(pool.slice()).slice(0, N).map((g, n) => {
    const blank = blankForm(g);
    let type = n % 4;
    if (type === 3 && !blank) type = n % 3;
    if (type === 2 && !((g.examples || [])[0] || {}).en) type = 0;
    const labelFn = type === 0 ? (o => o.meaning) : type === 2 ? gQuizLabelT : (o => o.point);
    return { g, type, blank, opts: pickGQuizOpts(pool, g, labelFn) };
  });
  let i = 0, score = 0, answered = false;
  function draw() {
    if (i >= qs.length) {
      const best = store.gQuizBest[lv] || 0;
      if (score > best) { store.gQuizBest[lv] = score; save(); }
      body.innerHTML = "<div class=\"card\"><h2>Quiz result: " + score + " / " + qs.length + "</h2>" +
        "<p class=\"explain\">Best grammar " + lv + ": " + Math.max(best, score) + " / " + qs.length + "</p>" +
        "<p><button class=\"btn primary\" id=\"qRetry\">Retry</button></p></div>";
      $("#qRetry").addEventListener("click", () => renderGQuiz(body, q));
      return;
    }
    const cur = qs[i], g = cur.g;
    const ex0 = (g.examples || [])[0] || {};
    const prompt = cur.type === 0
      ? "What does this mean?<span class=\"big jp gram-big\" lang=\"ja\">" + esc(g.point) + "</span>"
      : cur.type === 1
      ? "Which grammar point means: " + esc(g.meaning) + "?"
      : cur.type === 2
      ? "Which translation matches?<span class=\"mid jp\" lang=\"ja\">" + esc(ex0.jp || "") + "</span>"
      : "Fill in the blank:<span class=\"mid jp\" lang=\"ja\">" + esc((cur.blank || {}).blanked || "") + "</span>";
    const opts = cur.opts.map(o => {
      const label = cur.type === 0 ? o.meaning : cur.type === 2 ? gQuizLabelT(o) : o.point;
      const cls = cur.type === 0 ? "" : " jp";
      return "<button class=\"btn quiz-opt" + cls + "\" data-k=\"" + esc(o.id) + "\"" + (cur.type !== 0 ? " lang=\"ja\"" : "") + ">" + esc(label) + "</button>";
    }).join("");
    body.innerHTML =
      "<p class=\"explain\">" + lv + " grammar quiz &middot; question " + (i + 1) + " of " + qs.length + " &middot; score " + score + "</p>" +
      "<div class=\"card\"><p class=\"quiz-q\">" + prompt + "</p><div class=\"quiz-opts\">" + opts + "</div>" +
      "<p id=\"qFb\" class=\"explain\"></p></div>";
    $$(".quiz-opt", body).forEach(b => b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const ok = b.dataset.k === g.id;
      if (ok) { score++; b.classList.add("correct"); $("#qFb").textContent = "Correct! " + g.point + " = " + g.meaning; }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === g.id) x.classList.add("correct"); });
        $("#qFb").innerHTML = "Not quite &mdash; <a href=\"#/g/" + encodeURIComponent(g.id) + "\">" + esc(g.point) + "</a> means " + esc(g.meaning) + ".";
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      $("#qFb").after(nx);
    }));
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = "<div class=\"chip-row\" role=\"group\" aria-label=\"Quiz level\">" + LEVELS.map(l => "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("") + "</div>";
  body.innerHTML = "";
  body.appendChild(wrap);
  const holder = document.createElement("div");
  body.appendChild(holder);
  body = holder;
  $$(".chip", wrap).forEach(c => c.addEventListener("click", () => go("#/review?tab=quiz&kind=grammar&lv=" + c.dataset.lv)));
  draw();
}
/* ---------- Theme, search box, init ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = store.settings.theme === "dark" ? "dark" : "light";
  const icon = store.settings.theme === "dark" ? "☀" : "🌙";
  if ($("#themeBtn")) $("#themeBtn").textContent = icon;
  if ($("#themeBtn2")) $("#themeBtn2").textContent = icon;
}
function initChrome() {
  applyTheme();
  const flip = () => {
    store.settings.theme = store.settings.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
  };
  $("#themeBtn").addEventListener("click", flip);
  $("#themeBtn2").addEventListener("click", flip);
  $("#topSearch").addEventListener("submit", e => {
    e.preventDefault();
    go("#/search?q=" + encodeURIComponent($("#topSearchInput").value.trim()));
    $("#topSearchInput").value = "";
  });
}
window.KKBack = () => (window.Platform ? window.Platform.handleBackPress() : false);
try {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      if (!window.Platform.handleBackPress()) window.Capacitor.Plugins.App.exitApp();
    });
  }
} catch (e) { /* web: no native back handler */ }
loadData().then(() => { initChrome(); render(); }).catch(() => {
  $("#view").innerHTML = "<p class=\"empty\">Could not load data files. Serve this folder over HTTP (e.g. <code>python -m http.server</code>) and open it again — browsers block data files on file:// URLs.</p>";
});
