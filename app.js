"use strict";
/* Pengo - data-driven JLPT study app (no build step).
   Data: data/n5..n1.json + data/radicals.json + data/meta.json (see scripts/build_data.py).
   Vocab: data/vocab_n5..n1.json + data/vocab_meta.json (see scripts/build_vocab.py).
   Grammar: data/grammar_n5..n1.json + data/grammar_meta.json (see scripts/build_grammar.py).
   Pengo progress: localStorage key "knowkanji:v1". */

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const STORE_KEY = "knowkanji:v1";
const STROKE_BASE = "resources/stroke-order/kanjivg/";

const DB = { levels: {}, byChar: {}, vocab: {}, vById: {}, grammar: {}, gById: {}, meta: null, vocabMeta: null, grammarMeta: null, radicals: [], loaded: false };

const defaultStore = () => ({ learned: {}, fav: [], notes: {}, srs: {}, vLearned: {}, vFav: [], vNotes: {}, vSrs: {}, gLearned: {}, gFav: [], gNotes: {}, gSrs: {},
  settings: { theme: "light", dailyGoal: 10, autoplay: true, hideBanner: false }, quizBest: {}, vQuizBest: {}, gQuizBest: {}, course: null,
  study: { days: {}, loggedLearned: {} } });

let store = defaultStore();
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) store = Object.assign(defaultStore(), JSON.parse(raw));
} catch (e) { /* fresh start */ }
if (!store.settings) store.settings = defaultStore().settings;
if (store.settings.hideBanner == null) store.settings.hideBanner = false;
for (const _k of ["vLearned", "vNotes", "vSrs", "vQuizBest", "gLearned", "gNotes", "gSrs", "gQuizBest"]) if (!store[_k]) store[_k] = {};
if (!store.vFav) store.vFav = [];
if (!store.gFav) store.gFav = [];
if (!store.study || typeof store.study !== "object") store.study = { days: {}, loggedLearned: {} };
if (!store.study.days || typeof store.study.days !== "object") store.study.days = {};
if (!store.study.loggedLearned || typeof store.study.loggedLearned !== "object") store.study.loggedLearned = {};
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* full/blocked */ }
}

function studyDateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function studyDay(key) {
  if (!store.study.days[key]) store.study.days[key] = { seconds: 0, learned: 0 };
  return store.study.days[key];
}
function recordStudyItem(type, id) {
  var key = type + ":" + id;
  if (store.study.loggedLearned[key]) return;
  store.study.loggedLearned[key] = true;
  studyDay(studyDateKey(new Date())).learned++;
  save();
}
function migrateStudyItems() {
  if (store.study.migratedLearned) return;
  [["kanji", store.learned], ["vocab", store.vLearned], ["grammar", store.gLearned]].forEach(function (pair) {
    Object.keys(pair[1] || {}).forEach(function (id) {
      var stamp = pair[1][id], date = new Date(typeof stamp === "number" ? stamp : Date.now());
      var itemKey = pair[0] + ":" + id;
      if (store.study.loggedLearned[itemKey]) return;
      store.study.loggedLearned[itemKey] = true;
      studyDay(studyDateKey(date)).learned++;
    });
  });
  store.study.migratedLearned = true;
  save();
}
migrateStudyItems();

var studyTimeTick = Date.now();
var studyWasVisible = document.visibilityState !== "hidden";
var progressStatsTimer = null;
function flushStudyTime() {
  var now = Date.now(), elapsed = Math.min(30, Math.max(0, Math.floor((now - studyTimeTick) / 1000)));
  studyTimeTick = now;
  if (elapsed && studyWasVisible) {
    studyDay(studyDateKey(new Date(now))).seconds += elapsed;
    save();
  }
  studyWasVisible = document.visibilityState !== "hidden";
}
setInterval(flushStudyTime, 15000);
document.addEventListener("visibilitychange", flushStudyTime);
window.addEventListener("pagehide", flushStudyTime);

function exportBackup() {
  const text = JSON.stringify(store);
  if (window.KnowKanjiNative && typeof window.KnowKanjiNative.exportJson === "function") {
    window.KnowKanjiNative.exportJson("pengo-backup.json", text);
    return;
  }
  if (window.Platform && window.Platform.exportJson) { window.Platform.exportJson("pengo-backup.json", text); return; }
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pengo-backup.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
function importBackupText(text) {
  const message = function (text) {
    if (window.KnowKanjiNative && typeof window.KnowKanjiNative.showMessage === "function") window.KnowKanjiNative.showMessage(text);
    else alert(text);
  };
  try {
    const data = JSON.parse(text);
    const backupKeys = ["learned", "fav", "notes", "srs", "vLearned", "vFav", "vNotes", "vSrs", "gLearned", "gFav", "gNotes", "gSrs"];
    if (!data || typeof data !== "object" || Array.isArray(data) || !backupKeys.some(key => Object.prototype.hasOwnProperty.call(data, key))) {
      message("That file does not look like a Pengo backup.");
      return false;
    }
    store = Object.assign(defaultStore(), data);
    store.settings = Object.assign(defaultStore().settings,
      data.settings && typeof data.settings === "object" && !Array.isArray(data.settings) ? data.settings : {});
    if (!store.study || typeof store.study !== "object" || Array.isArray(store.study)) store.study = { days: {}, loggedLearned: {} };
    if (!store.study.days || typeof store.study.days !== "object" || Array.isArray(store.study.days)) store.study.days = {};
    if (!store.study.loggedLearned || typeof store.study.loggedLearned !== "object" || Array.isArray(store.study.loggedLearned)) store.study.loggedLearned = {};
    for (const key of ["learned", "notes", "srs", "vLearned", "vNotes", "vSrs", "gLearned", "gNotes", "gSrs", "quizBest", "vQuizBest", "gQuizBest"]) {
      if (!store[key] || typeof store[key] !== "object" || Array.isArray(store[key])) store[key] = {};
    }
    for (const key of ["fav", "vFav", "gFav"]) if (!Array.isArray(store[key])) store[key] = [];
    migrateStudyItems();
    save(); applyTheme(); render();
    message("Backup imported.");
    return true;
  } catch (err) {
    message("Could not read that file.");
    return false;
  }
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
  { path: "#/", label: "Home", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z\"/></svg>", match: "home" },
  { path: "#/learn", label: "Learn", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"M12 7v14M12 7C9 4 5 4 2 5v14c4-1 7 0 10 2m0-14c3-3 7-3 10-2v14c-4-1-7 0-10 2\"/></svg>", match: "learn" },
  { path: "#/review", label: "Review", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"M20 7v5h-5M4 17v-5h5\"/><path d=\"M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3\"/></svg>", match: "review" },
  { path: "#/search", label: "Search", ico: "<svg viewBox=\"0 0 24 24\"><circle cx=\"10.8\" cy=\"10.8\" r=\"6.8\"/><path d=\"m16 16 5 5\"/></svg>", match: "search" },
  { path: "#/progress", label: "Progress", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"M4 20V12h4v8zm6 0V4h4v16zm6 0V9h4v11z\"/></svg>", match: "progress" },
  { path: "#/settings", label: "Settings", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z\"/><path d=\"m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z\"/></svg>", match: "settings" }
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
  if (active === "kanji" || active === "vocab" || active === "grammar") active = "learn";
  const html = NAV.map(n =>
    "<a href=\"" + n.path + "\"" + (n.match === active ? " aria-current=\"page\"" : "") + ">" +
    "<span class=\"ico\" aria-hidden=\"true\">" + n.ico + "</span><span>" + n.label + "</span></a>").join("");
  $("#sideNav").innerHTML = html;
  $("#bottomNav").innerHTML = NAV.filter(n => ["home", "learn", "review", "progress", "settings"].indexOf(n.match) >= 0).map(n =>
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
  const creditsFooter = $("#creditsFooter");
  if (creditsFooter) creditsFooter.hidden = name !== "settings";
  if (name === "kanji" && seg[1] && DB.byChar[seg[1]]) { renderNav("learn"); renderDetail(view, seg[1]); }
  else if (name === "kanji") { renderNav("learn"); renderBrowse(view, seg[1], q); }
  else if (name === "k" && seg[1]) { renderNav("learn"); renderDetail(view, seg[1]); }
  else if (name === "learn") { renderNav("learn"); renderLearn(view, q); }
  else if (name === "vocab" && seg[1]) { renderNav("learn"); renderVocabBrowse(view, seg[1], q); }
  else if (name === "vocab") { renderNav("learn"); renderVocabHome(view); }
  else if (name === "v" && seg[1]) { renderNav("learn"); renderVocabDetail(view, seg[1]); }
  else if (name === "grammar" && seg[1]) { renderNav("learn"); renderGrammarBrowse(view, seg[1], q); }
  else if (name === "grammar") { renderNav("learn"); renderGrammarHome(view); }
  else if (name === "g" && seg[1]) { renderNav("learn"); renderGrammarDetail(view, seg[1]); }
  else if (name === "study") { // removed study, redirect to quiz
    if (q.kind === "vocab") go("#/review?tab=quiz&kind=vocab");
    else if (q.kind === "grammar") go("#/review?tab=quiz&kind=grammar");
    else go("#/review?tab=quiz");
  }
  else if (name === "course") { renderNav("home"); renderCourse(view, seg[1], q); }
  else if (name === "review") { renderNav("review"); renderReview(view, q); }
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
    recordStudyItem("kanji", ch);
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
/* ---------- Home: level-picker splash, then course dashboard ----------
   Browsing lives under Learn; Home stays clean and shows the plan. */
function courseGreeting() {
  var part = "morning";
  try { part = Course.dayPart(new Date().getHours()); } catch (e) {}
  return part === "afternoon" ? "Good afternoon!" : part === "evening" ? "Good evening!" : "Good morning!";
}
function courseStudiedToday() {
  var today = new Date().toDateString(), n = 0, k, m;
  var maps = [store.learned, store.vLearned || {}, store.gLearned || {}];
  for (m = 0; m < maps.length; m++) {
    for (k in maps[m]) {
      if (typeof maps[m][k] === "number" && new Date(maps[m][k]).toDateString() === today) n++;
    }
  }
  return n;
}
function courseTodaysBatch() {
  var cur = courseCurriculum();
  var day = Math.min(courseUnlockedDay(), cur.length + 1);
  if (day > cur.length) return { day: day, total: cur.length, items: [], done: 0, complete: true };
  var items = [];
  ["kanji", "vocab", "grammar"].forEach(function (t) {
    (cur[day - 1][t] || []).forEach(function (id) { items.push({ type: t, id: id }); });
  });
  var done = items.filter(function (it) { return courseIsLearned(it.type, it.id); }).length;
  return { day: day, total: cur.length, items: items, done: done, complete: false };
}
function renderHome(view) {
  if (!store.course) { renderHomeSplash(view); return; }
  renderHomeDash(view);
}
function renderHomeSplash(view) {
  var order = ["N1", "N2", "N3", "N4", "N5"];
  var names = (typeof Course !== "undefined" && Course.LEVEL_NAMES) || {};
  view.innerHTML =
    "<div class=\"splash\">" +
    "<h1>Which JLPT level<br>are you preparing for?</h1>" +
    "<div class=\"splash-levels\">" + order.map(function (lv) {
      return "<a class=\"splash-lv lv-" + lv.toLowerCase() + "\" href=\"#/course/setup?target=" + lv + "\">" +
        "<span class=\"splash-lv-code\">" + lv + "</span>" +
        "<span class=\"splash-lv-name\">" + esc(names[lv] || "") + "</span></a>";
    }).join("") + "</div>" +
    "<p class=\"splash-cheer\" lang=\"ja\">\u304c\u3093\u3070\u308d\u3046\uff01<span>Let\u2019s do it!</span></p>" +
    "<img class=\"splash-mascot\" src=\"assets/pengo-mascot.png\" alt=\"Pengo cheering you on\">" +
    "<div class=\"splash-dots\" aria-hidden=\"true\"><i></i><i></i><i class=\"on\"></i><i></i></div></div>";
}
function renderHomeDash(view) {
  var c = store.course;
  var batch = courseTodaysBatch();
  var streak = Course.calcStreak(c.studyDays || [], Course.todayStr());
  var studied = courseStudiedToday();
  var goal = Math.max(c.dailyNew || 20, 1);
  var goalDone = Math.min(studied, goal);
  var batchPct = batch.items.length ? Math.round(batch.done / batch.items.length * 100) : 100;
  var contTitle = batch.complete ? "Course complete" : c.target + " \u00b7 Day " + batch.day;
  var contSub = batch.complete ? "All material unlocked - keep reviewing" : batch.done + " / " + batch.items.length + " studied";
  var contHref = batch.complete ? "#/course/quiz" : "#/course/day";
  var tiles = [
    { t: "Kanji", ch: "\u6f22", href: "#/kanji/" + c.target, cls: "t1" },
    { t: "Vocab", ch: "\u8a9e", href: "#/vocab/" + c.target, cls: "t2" },
    { t: "Grammar", ch: "\u6587", href: "#/grammar/" + c.target, cls: "t3" },
    { t: "Review", ch: "\u8a66", href: "#/review?lv=" + c.target, cls: "t4" }
  ];
  var due = dueCount();
  view.innerHTML =
    "<div class=\"dash-hero\">" +
    "<div class=\"dash-hello\">" + courseGreeting() + "</div>" +
    "<p class=\"dash-tag\">A little progress each day leads to big results.</p>" +
    "<img class=\"dash-mascot\" src=\"assets/pengo-mascot.png\" alt=\"Pengo reading a book\"></div>" +
    "<div class=\"card dash-continue\"><h2>Continue Learning</h2>" +
    "<div class=\"dash-cont-row\"><span class=\"dash-badge\">" + esc(c.target) + "</span>" +
    "<div class=\"dash-cont-meta\"><b>" + esc(contTitle) + "</b><span>" + esc(contSub) + "</span></div>" +
    "<a class=\"btn primary\" href=\"" + contHref + "\">Start &rarr;</a></div>" +
    (batchPct > 0 ? progressBar(batchPct) : "") + "</div>" +
    "<div class=\"dash-tiles\">" + tiles.map(function (t) {
      return "<a class=\"dash-tile " + t.cls + "\" href=\"" + t.href + "\">" +
        "<span class=\"dash-tile-ico\" aria-hidden=\"true\">" + t.ch + "</span>" + t.t + "</a>";
    }).join("") + "</div>" +
    "<div class=\"card\"><h2>Today\u2019s Goal</h2>" +
    "<div class=\"dash-goal-num\">" + goalDone + " / " + goal + " items</div>" +
    progressBar(Math.round(goalDone / goal * 100)) + "</div>" +
    "<p class=\"explain\">" + streak + " day streak &middot; " + courseScheduleText() + "</p>" +
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/review\">Review now &mdash; " + due + " due</a></p>" : "") +
    "<div class=\"card\"><h2>Milestones</h2>" + courseMilestoneHTML() + "</div>";
}
/* ---------- Learn (one tab for Kanji, Vocabulary, Grammar) ---------- */
function renderLearn(view, q) {
  const defaultLv = store.course && LEVELS.includes(String(store.course.target || "").toUpperCase())
    ? String(store.course.target).toUpperCase() : "N5";
  const lv = LEVELS.includes((q.lv || "").toUpperCase()) ? q.lv.toUpperCase() : defaultLv;
  const ks = levelStats(lv), vs = vLevelStats(lv), gs = gLevelStats(lv);
  const lvBtns = LEVELS.map(l => "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  view.innerHTML =
    "<h1>Learn</h1>" +
    "<p class=\"explain\">Pick a JLPT level, then choose what to study: kanji, vocabulary, grammar \u2014 or jump straight into a review quiz for that level.</p>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"Learn level\">" + lvBtns + "</div>" +
    "<div class=\"level-grid\">" +
    "<a class=\"level-card\" href=\"#/kanji/" + lv + "\"><div class=\"lvl\"><span class=\"dash-tile-ico t1\" aria-hidden=\"true\">\u6f22</span> Kanji <small>" + ks.total + " kanji</small></div>" +
    "<div class=\"count\">" + ks.learned + " / " + ks.total + " learned</div>" + progressBar(ks.pct) +
    "<div class=\"progress-label\">" + ks.pct + "% complete \u00b7 " + ks.left + " left</div></a>" +
    "<a class=\"level-card\" href=\"#/vocab/" + lv + "\"><div class=\"lvl\"><span class=\"dash-tile-ico t2\" aria-hidden=\"true\">\u8a9e</span> Vocab <small>" + vs.total + " words</small></div>" +
    "<div class=\"count\">" + vs.learned + " / " + vs.total + " learned</div>" + progressBar(vs.pct) +
    "<div class=\"progress-label\">" + vs.pct + "% complete \u00b7 " + vs.left + " left</div></a>" +
    "<a class=\"level-card\" href=\"#/grammar/" + lv + "\"><div class=\"lvl\"><span class=\"dash-tile-ico t3\" aria-hidden=\"true\">\u6587</span> Grammar <small>" + gs.total + " points</small></div>" +
    "<div class=\"count\">" + gs.learned + " / " + gs.total + " learned</div>" + progressBar(gs.pct) +
    "<div class=\"progress-label\">" + gs.pct + "% complete \u00b7 " + gs.left + " left</div></a>" +
    "<div class=\"level-card\"><div class=\"lvl\"><span class=\"dash-tile-ico t4\" aria-hidden=\"true\">\u8a66</span> Review <small>" + lv + " quiz</small></div>" +
    "<div class=\"count\">Test yourself on " + lv + "</div>" +
    "<p><a class=\"btn soft\" href=\"#/review?kind=kanji&lv=" + lv + "\">Kanji</a> " +
    "<a class=\"btn soft\" href=\"#/review?kind=vocab&lv=" + lv + "\">Vocab</a> " +
    "<a class=\"btn soft\" href=\"#/review?kind=grammar&lv=" + lv + "\">Grammar</a></p></div>" +
    "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/learn?lv=" + c.dataset.lv)));
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
  const query = q.q || "", filt = q.f || "all", sort = q.s || "freq";
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
    "<input type=\"search\" id=\"bq\" placeholder=\"Search\" value=\"" + esc(query) + "\" aria-label=\"Search\">" +
    "<select id=\"bf\" aria-label=\"Filter\"><option value=\"all\">All</option>" +
    "<option value=\"learned\"" + (filt === "learned" ? " selected" : "") + ">Learned</option>" +
    "<option value=\"unlearned\"" + (filt === "unlearned" ? " selected" : "") + ">Unlearned</option>" +
    "<option value=\"fav\"" + (filt === "fav" ? " selected" : "") + ">★ Favorites</option></select>" +
    "<select id=\"bs\" aria-label=\"Sort\"><option value=\"default\"" + (sort === "default" ? " selected" : "") + ">Dataset order</option>" +
    "<option value=\"freq\"" + (sort === "freq" ? " selected" : "") + ">Most frequent</option>" +
    "<option value=\"strokes\"" + (sort === "strokes" ? " selected" : "") + ">Fewest strokes</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">Meaning A–Z</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option></select>" +
    "</div>" +
    "<p class=\"result-count\" id=\"browseResultCount\">" + recs.length + " / " + DB.levels[lv].length + " kanji · " + lv + "</p>" +
    "<div class=\"kanji-grid\" id=\"browseGrid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/kanji/" + c.dataset.lv)));
  bindBrowseSearch("bq", "browseResultCount", "browseGrid", function (text) {
    let matches = DB.levels[lv].filter(item => matchQuery({ item: item, level: lv }, text));
    if (filt === "learned") matches = matches.filter(item => isLearned(item.k));
    else if (filt === "unlearned") matches = matches.filter(item => !isLearned(item.k));
    else if (filt === "fav") matches = matches.filter(item => isFav(item.k));
    if (sort === "strokes") matches.sort((a, b) => (a.strokes || 99) - (b.strokes || 99));
    else if (sort === "freq") matches.sort((a, b) => (a.freq || 99999) - (b.freq || 99999));
    else if (sort === "alpha") matches.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
    else if (sort === "progress") matches.sort((a, b) => ((store.learned[a.k] ? 1 : 0) - (store.learned[b.k] ? 1 : 0)));
    return matches;
  }, function (item) { return kanjiCard(item, lv); }, "kanji", lv, link);
  $("#bf").addEventListener("change", e => go(link({ f: e.target.value })));
  $("#bs").addEventListener("change", e => go(link({ s: e.target.value })));
}

/* Update browse results without replacing the focused search input. Rebuilding
   the view on each query change blurs Android's WebView input and hides its IME. */
function bindBrowseSearch(inputId, countId, gridId, filterItems, renderCard, kind, level, link) {
  let deb = null;
  const input = $("#" + inputId);
  const grid = $("#" + gridId);
  const count = $("#" + countId);
  input.addEventListener("input", function () {
    clearTimeout(deb);
    const text = input.value;
    deb = setTimeout(function () {
      const items = filterItems(text);
      grid.innerHTML = items.length ? items.map(renderCard).join("") :
        "<p class=\"empty\">No results match. Try a different search or filter.</p>";
      if (kind === "kanji") count.textContent = items.length + " / " + DB.levels[level].length + " kanji · " + level;
      else if (kind === "vocab") count.innerHTML = items.length + " words · <a href=\"#/review?tab=quiz&kind=vocab&lv=" + level + "\">Quiz " + level + "</a>";
      else count.innerHTML = items.length + " points · <a href=\"#/review?tab=quiz&kind=grammar&lv=" + level + "\">Quiz " + level + "</a>";
      const hash = link({ q: text });
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }, 150);
  });
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
    if (!store.learned[ch]) { store.learned[ch] = Date.now(); recordStudyItem("kanji", ch); }
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
/* ---------- Quiz result celebration (Pengo stickers) ---------- */
function quizResultHTML(o) {
  const total = o.total || 0;
  const pct = total ? o.score / total : 0;
  const good = pct >= 0.7;
  const img = good ? "assets/pengo-happy.png" : "assets/pengo-study.png";
  const cls = good ? "good" : "study";
  const title = good ? "Amazing work!" : "Good effort \u2014 keep going!";
  const msg = good
    ? "Pengo is doing a happy dance! You scored " + o.score + " / " + total + " on " + o.lv + ". Keep the streak going!"
    : "You scored " + o.score + " / " + total + " on " + o.lv + ". Pengo is hitting the books with you \u2014 review the level and try again. \u304c\u3093\u3070\u308d\u3046!";
  const kind = o.kind || "kanji";
  return "<div class=\"card quiz-result " + cls + "\">" +
    "<img class=\"quiz-result-img\" src=\"" + img + "\" alt=\"" + (good ? "Pengo cheering with confetti" : "Pengo studying hard with a notebook") + "\">" +
    "<h2>" + title + "</h2>" +
    "<p class=\"quiz-score\">" + o.score + " / " + total + "</p>" +
    "<p class=\"explain\">" + msg + "</p>" +
    "<p class=\"explain\">Best on " + o.lv + ": " + o.best + " / " + total + "</p>" +
    "<p><button class=\"btn primary\" id=\"qRetry\">Retry</button> " +
    "<a class=\"btn soft\" href=\"#/learn?lv=" + o.lv + "\">Study " + o.lv + "</a> " +
    "<a class=\"btn soft\" href=\"#/review?kind=" + kind + "&lv=" + o.lv + "\">More quizzes</a></p></div>";
}
function quizClip(text, limit) {
  text = String(text || "").trim();
  return text.length > limit ? text.slice(0, limit).trim() + "…" : text;
}
function quizReviewHTML(kind, item) {
  if (kind === "kanji") {
    const readings = [];
    if (item.on && item.on.length) readings.push("<span><strong>On:</strong> <span lang=\"ja\">" + esc(item.on.join("、 ")) + "</span></span>");
    if (item.kun && item.kun.length) readings.push("<span><strong>Kun:</strong> <span lang=\"ja\">" + esc(item.kun.join("、 ")) + "</span></span>");
    const parts = (item.components || []).slice(0, 3).map(c => "<span class=\"badge\"><span lang=\"ja\">" + esc(c.c) + "</span> " + esc(c.m) + "</span>").join(" ");
    const words = (item.vocab || []).slice(0, 2).map(v => "<li><span lang=\"ja\">" + esc(v.w) + " (" + esc(v.r) + ")</span> — " + esc(v.m) + "</li>").join("");
    const mnemonic = quizClip(mnemonicFor(item).text, 180);
    return "<section class=\"card quiz-review\"><h3>Quick review <span lang=\"ja\">" + esc(item.k) + "</span></h3>" +
      "<p><strong>Meaning:</strong> " + esc(item.meaning) + (item.strokes ? " <span class=\"badge\">" + item.strokes + " strokes</span>" : "") + "</p>" +
      (readings.length ? "<p class=\"quiz-review-readings\">" + readings.join(" &nbsp; ") + "</p>" : "") +
      (parts ? "<p><strong>Parts:</strong> " + parts + "</p>" : "") +
      (mnemonic ? "<p><strong>Memory aid:</strong> " + esc(mnemonic) + "</p>" : "") +
      (words ? "<p><strong>Example words</strong></p><ul class=\"quiz-review-list\">" + words + "</ul>" : "") + "</section>";
  }
  if (kind === "vocab") {
    const ex = (item.sentences || [])[0];
    return "<section class=\"card quiz-review\"><h3>Quick review <span lang=\"ja\">" + esc(item.word) + "</span></h3>" +
      "<p><strong>Reading:</strong> <span lang=\"ja\">" + esc(item.reading) + "</span> &nbsp; <strong>Meaning:</strong> " + esc(item.meaning) + "</p>" +
      (item.meanings && item.meanings.length > 1 ? "<p><strong>Also:</strong> " + esc(item.meanings.slice(1, 4).join("; ")) + "</p>" : "") +
      (ex ? "<p class=\"quiz-review-example jp\" lang=\"ja\">" + esc(ex.jp) + "</p>" + (ex.en ? "<p class=\"explain quiz-review-translation\">" + esc(ex.en) + "</p>" : "") : "") + "</section>";
  }
  const formation = (item.sections || []).find(s => String(s.label || "").toLowerCase() === "formation");
  const example = (item.examples || [])[0];
  return "<section class=\"card quiz-review\"><h3>Quick review <span lang=\"ja\">" + esc(item.point) + "</span></h3>" +
    "<p><strong>Meaning:</strong> " + esc(item.meaning) + "</p>" +
    (formation ? "<p><strong>Formation:</strong> " + esc(quizClip(stripTags(formation.html), 220)) + "</p>" : "") +
    (example ? "<p class=\"quiz-review-example jp\" lang=\"ja\">" + esc(example.jp) + "</p>" + (example.en ? "<p class=\"explain quiz-review-translation\">" + esc(example.en) + "</p>" : "") : "") +
    "</section>";
}
function showQuizAnswer(body, correct, kind, item, nextButton) {
  $("#qFb").textContent = correct ? "Correct!" : "Not quite.";
  $("#qFb").closest(".card").insertAdjacentHTML("afterend", quizReviewHTML(kind, item));
  body.appendChild(nextButton);
}
function renderReview(view, q) {
  const kind = q.kind === "vocab" ? "vocab" : q.kind === "grammar" ? "grammar" : "kanji";
  const lv = LEVELS.includes((q.lv || "").toUpperCase()) ? q.lv.toUpperCase() : "N5";
  const dK = dueCount(), dV = vDueCount(), dG = gDueCount();
  const kindBtn = (k, label, due) => "<button class=\"chip\" data-kind=\"" + k + "\" aria-pressed=\"" + (k === kind) + "\">" + label + (due > 0 ? " \u00b7 " + due + " due" : "") + "</button>";
  const lvBtns = LEVELS.map(l => "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  view.innerHTML =
    "<h1>Review</h1>" +
    "<p class=\"explain\">Choose what to review \u2014 kanji, vocabulary or grammar \u2014 then pick a level below and start the quiz.</p>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"Review type\">" +
    kindBtn("kanji", "\u6f22 Kanji", dK) + kindBtn("vocab", "\u8a9e Vocab", dV) + kindBtn("grammar", "\u6587 Grammar", dG) + "</div>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"Review level\">" + lvBtns + "</div>" +
    "<div id=\"revBody\"></div>";
  $$("[data-kind]", view).forEach(c => c.addEventListener("click", () => go("#/review?kind=" + c.dataset.kind + "&lv=" + lv)));
  $$("[data-lv]", view).forEach(c => c.addEventListener("click", () => go("#/review?kind=" + kind + "&lv=" + c.dataset.lv)));
  const body = view.querySelector("#revBody");
  if (kind === "vocab") renderVQuiz(body, q);
  else if (kind === "grammar") renderGQuiz(body, q);
  else renderQuiz(body, q);
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
      body.innerHTML = quizResultHTML({ kind: "kanji", lv: lv, score: score, total: qs.length, best: Math.max(best, score) });
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
      if (ok) { score++; b.classList.add("correct"); }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === it.k) x.classList.add("correct"); });
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next →";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      showQuizAnswer(body, ok, "kanji", it, nx);
    }));
  }
  body.innerHTML = "";
  draw();
}

/* ---------- Search ---------- */
function renderSearch(view, q) {
  const query = q.q || "";
  view.innerHTML =
    "<h1>Search</h1>" +
    "<div class=\"toolbar\"><input type=\"search\" id=\"sq\" placeholder=\"Kanji, word, English meaning, or reading...\" value=\"" + esc(query) + "\" aria-label=\"Search\"></div>" +
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

/* ---------- Pengo progress ---------- */
function combinedLevelStats(lv) {
  var k = levelStats(lv), v = vLevelStats(lv), g = gLevelStats(lv);
  var total = k.total + v.total + g.total;
  var learned = k.learned + v.learned + g.learned;
  return { total: total, learned: learned, left: total - learned,
    pct: total ? Math.round(learned / total * 100) : 0,
    kanji: k, vocab: v, grammar: g };
}
function pengoNum(n) { return Number(n || 0).toLocaleString("en-US"); }
function studyDuration(seconds) {
  var mins = Math.floor(seconds / 60), hours = Math.floor(mins / 60), rem = mins % 60;
  if (seconds > 0 && mins === 0) return "&lt;1m";
  return hours ? hours + "h " + rem + "m" : mins + "m";
}
function studyStatsHTML(period) {
  var count = period === "month" ? 30 : 7;
  var today = new Date(), days = [], totalLearned = 0, totalSeconds = 0, studied = 0, maxLearned = 0;
  for (var i = count - 1; i >= 0; i--) {
    var date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    var key = studyDateKey(date), data = store.study.days[key] || { learned: 0, seconds: 0 };
    var learned = Number(data.learned || 0), seconds = Number(data.seconds || 0);
    days.push({ date: date, learned: learned, seconds: seconds });
    totalLearned += learned; totalSeconds += seconds;
    if (learned || seconds) studied++;
    if (learned > maxLearned) maxLearned = learned;
  }
  var bars = days.map(function (day) {
    var label = period === "week" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.date.getDay()] : String(day.date.getDate());
    var value = day.learned;
    var height = value ? Math.max(5, Math.round(value / Math.max(maxLearned, 1) * 100)) : 0;
    var dateLabel = day.date.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
    return "<div class=\"study-bar-col\" title=\"" + dateLabel + ": " + value + " items learned\" aria-label=\"" + dateLabel + ": " + value + " items learned\">" +
      "<div class=\"study-bar-area\"><span class=\"study-bar\" style=\"height:" + height + "%\"></span></div>" +
      "<span class=\"study-bar-label\">" + label + "</span><span class=\"study-bar-value\">" + value + "</span></div>";
  }).join("");
  var periodLabel = period === "month" ? "This Month" : "This Week";
  return "<section class=\"pg-card study-stats\" aria-label=\"Study stats for " + periodLabel + "\">" +
    "<div class=\"study-stats-head\"><h2>Study Stats</h2><label class=\"sr-only\" for=\"studyPeriod\">Time period</label>" +
    "<select id=\"studyPeriod\"><option value=\"week\"" + (period === "week" ? " selected" : "") + ">This Week</option>" +
    "<option value=\"month\"" + (period === "month" ? " selected" : "") + ">This Month</option></select></div>" +
    "<div class=\"study-chart-scroll\"><div class=\"study-chart study-chart-" + period + "\" role=\"group\" aria-label=\"Items learned each day\">" + bars + "</div></div>" +
    "<div class=\"study-summary\"><div><span class=\"study-summary-icon books\" aria-hidden=\"true\">▤</span><span><strong>" + pengoNum(totalLearned) + "</strong><small>Items learned</small></span></div>" +
    "<div><span class=\"study-summary-icon time\" aria-hidden=\"true\">◷</span><span><strong>" + studyDuration(totalSeconds) + "</strong><small>Study time</small></span></div>" +
    "<div><span class=\"study-summary-icon calendar\" aria-hidden=\"true\">▦</span><span><strong>" + studied + " / " + count + "</strong><small>Days studied</small></span></div></div></section>";
}
function renderProgress(view) {
  var q = {};
  try {
    var h = String(location.hash || ""), qi = h.indexOf("?"), i, kv;
    if (qi >= 0) {
      var parts = h.slice(qi + 1).split("&");
      for (i = 0; i < parts.length; i++) {
        kv = parts[i].split("=");
        q[decodeURIComponent(kv[0] || "")] = decodeURIComponent(kv[1] || "");
      }
    }
  } catch (e) {}
  var heroLevel = q.level || (store.course && store.course.target) || "";
  if (LEVELS.indexOf(heroLevel) < 0) {
    heroLevel = "N5";
    for (i = 0; i < LEVELS.length; i++) {
      var cand = combinedLevelStats(LEVELS[i]);
      if (cand.total > 0 && cand.pct < 100) { heroLevel = LEVELS[i]; break; }
    }
  }
  var hero = combinedLevelStats(heroLevel);
  var period = q.period === "month" ? "month" : "week";
  var chips = LEVELS.map(function (lv) {
    return "<a class=\"pg-chip" + (lv === heroLevel ? " active" : "") + "\" href=\"#/progress?level=" + lv + "&period=" + period + "\">" + lv + "</a>";
  }).join("");
  function categoryRing(label, stats, color) {
    var R = 48, CIRC = 2 * Math.PI * R;
    var pct = stats.pct || 0;
    var off = (CIRC * (1 - pct / 100)).toFixed(1);
    return "<div class=\"pg-ring-block\"><svg class=\"pg-ring\" viewBox=\"0 0 120 120\" role=\"img\" aria-label=\"" + label + ": " + pct + "% complete\">" +
      "<circle cx=\"60\" cy=\"60\" r=\"" + R + "\" fill=\"none\" class=\"pg-ring-track\" stroke-width=\"11\"/>" +
      "<circle cx=\"60\" cy=\"60\" r=\"" + R + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"11\" stroke-linecap=\"round\" " +
      "stroke-dasharray=\"" + CIRC.toFixed(1) + "\" stroke-dashoffset=\"" + off + "\" transform=\"rotate(-90 60 60)\"/>" +
      "<text x=\"60\" y=\"67\" text-anchor=\"middle\" class=\"pg-ring-pct\">" + pct + "%</text></svg>" +
      "<div class=\"pg-ring-label\">" + label + "</div><div class=\"pg-count\">" + pengoNum(stats.learned) + " / " + pengoNum(stats.total) + "</div></div>";
  }
  var html = [];
  html.push("<div class=\"pg-wrap\">");
  html.push("<div class=\"pg-head\"><a class=\"pg-back\" href=\"#/\" aria-label=\"Back home\">&#8592;</a><h1>Progress</h1><span class=\"pg-head-spacer\"></span></div>");
  html.push("<section class=\"pg-card pg-hero\" aria-label=\"" + heroLevel + " progress\">");
  html.push("<h2>" + heroLevel + " Progress</h2>");
  html.push("<div class=\"pg-level-chips\">" + chips + "</div>");
  html.push("<div class=\"pg-category-rings\">" +
    categoryRing("Kanji", hero.kanji, "#2f80ed") +
    categoryRing("Vocab", hero.vocab, "#9b6ce0") +
    categoryRing("Grammar", hero.grammar, "#34a875") + "</div>");
  html.push("<p class=\"pg-hero-sub\"><a href=\"#/kanji/" + heroLevel + "\">Study " + heroLevel + "</a></p>");
  html.push("</section>");
  html.push(studyStatsHTML(period));
  html.push("</div>");
  view.innerHTML = html.join("");
  if (progressStatsTimer) clearInterval(progressStatsTimer);
  function bindStudyPeriod() {
    var picker = $("#studyPeriod", view);
    if (picker) picker.addEventListener("change", function (e) {
      go("#/progress?level=" + heroLevel + "&period=" + e.target.value);
    });
  }
  bindStudyPeriod();
  progressStatsTimer = setInterval(function () {
    if (String(location.hash || "").indexOf("#/progress") !== 0) { clearInterval(progressStatsTimer); progressStatsTimer = null; return; }
    flushStudyTime();
    var card = $(".study-stats", view);
    if (card) { card.outerHTML = studyStatsHTML(period); bindStudyPeriod(); }
  }, 15000);
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
    "<button class=\"btn soft\" id=\"sImportButton\" type=\"button\">Import backup</button>" +
    "<input type=\"file\" id=\"sImport\" accept=\"application/json\" hidden>" +
    "<button class=\"btn soft danger\" id=\"sWipe\">Erase everything</button></div>" +
    "<p class=\"explain\">" + storeNote() + "</p></div>" +
    courseSettingsCard() +
    "<div class=\"card\"><h2>About the data</h2>" +
    "<p class=\"explain\">Kanji facts: KANJIDIC2 + curated JLPT files. Components: EDRDG KRADFILE. " +
    "Stroke art: KanjiVG (" + (DB.meta ? LEVELS.map(l => DB.meta.levels[l].stroke + "/" + DB.meta.levels[l].count + " " + l).join(" · ") : "") + "). " +
    "Sentences: Tanaka Corpus + CSV set. Accents: Kanjium. Loader: " + (DB.source || "?") + ". Vocab: JLPT lists (" + (DB.vocabMeta ? DB.vocabMeta.total : vAll().length) + " words) + Tatoeba sentences (" + (DB.vocabMeta ? DB.vocabMeta.withSentences : 0) + " with matches). Grammar: Anki deck ‘Japanese Core Grammar JLPT N5-N1’ (" + (DB.grammarMeta ? DB.grammarMeta.total : gAll().length) + " points, text only, no audio used, no licence stated). Full credits in resources/CREDITS.md.</p></div>" +
    "<div class=\"card\"><h2>About this app</h2>" +
    "<p><button class=\"btn soft\" id=\"sIntro\">Replay intro</button></p>" + 
    "<p class=\"explain\">Pengo " + (window.APP_VERSION || "1.0.0") + " runs fully offline: all kanji, vocabulary and grammar data (incl. example sentences) plus stroke diagrams are bundled, with no account or network needed. Sources: KANJIDIC2, KRADFILE (EDRDG), KanjiVG, Tanaka Corpus, Kanjium. See resources/CREDITS.md for full attribution.</p></div>";
  $("#sTheme").addEventListener("click", e => {
    s.theme = s.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
    e.target.textContent = "Theme: " + s.theme;
  });
  $("#sAuto").addEventListener("change", e => { s.autoplay = e.target.checked; save(); });
  $("#sExport").addEventListener("click", () => {
    exportBackup();
  });
  $("#sImportButton").addEventListener("click", () => {
    if (window.KnowKanjiNative && typeof window.KnowKanjiNative.importJson === "function") window.KnowKanjiNative.importJson();
    else $("#sImport").click();
  });
  $("#sImport").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importBackupText(r.result);
    r.readAsText(f);
  });
  $("#sWipe").addEventListener("click", () => {
    const actions = $("#wipeActions");
    if (actions) return;
    const panel = document.createElement("div");
    panel.id = "wipeActions";
    panel.className = "wipe-confirm";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-labelledby", "wipeTitle");
    panel.innerHTML = "<p id=\"wipeTitle\"><strong>Erase all data, including settings?</strong><br>This cannot be undone.</p>" +
      "<button class=\"btn danger\" id=\"sWipeConfirm\">Erase all data</button> " +
      "<button class=\"btn soft\" id=\"sWipeCancel\">Cancel</button>";
    $("#sWipe").closest(".card").appendChild(panel);
    $("#sWipeConfirm").addEventListener("click", () => {
      store = defaultStore(); save(); applyTheme();
      try { localStorage.removeItem(ONBOARD_KEY); } catch (e) {}
      render();
    });
    $("#sWipeCancel").addEventListener("click", () => panel.remove());
  });
  const sIntro = $("#sIntro");
  if (sIntro) sIntro.addEventListener("click", () => showOnboarding(() => render()));
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
    if (!store.vLearned[id]) { store.vLearned[id] = Date.now(); recordStudyItem("vocab", id); }
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
    recordStudyItem("vocab", id);
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
  const query = q.q || "", filt = q.f || "all", sort = q.s || "freq";
  const link = (over) => "#/vocab/" + lv + "?" + new URLSearchParams(Object.assign({ q: query, f: filt, s: sort }, over)).toString();
  let recs = (DB.vocab[lv] || []).slice();
  recs = recs.filter(v => matchVQuery(v, query));
  if (filt === "learned") recs = recs.filter(v => isVLearned(v.id));
  else if (filt === "unlearned") recs = recs.filter(v => !isVLearned(v.id));
  else if (filt === "fav") recs = recs.filter(v => isVFav(v.id));
  else if (filt === "nosent") recs = recs.filter(v => !(v.sentences && v.sentences.length));
  if (sort === "freq") recs = Course.sortVocab(recs, courseKanjiFreqMap(), courseKanjiMedian(lv));
  else if (sort === "alpha") recs.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
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
    "<option value=\"default\"" + (sort === "default" ? " selected" : "") + ">Dataset order</option>" +
    "<option value=\"freq\"" + (sort === "freq" ? " selected" : "") + ">Most frequent</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">A-Z</option>" +
    "<option value=\"reading\"" + (sort === "reading" ? " selected" : "") + ">Reading</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option>" +
    "</select></div>" +
    "<p class=\"result-count\" id=\"vocabResultCount\">" + recs.length + " words · <a href=\"#/review?tab=quiz&kind=vocab&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
    "<div class=\"kanji-grid\" id=\"vocabGrid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/vocab/" + c.dataset.lv + "?" + new URLSearchParams({ q: query, f: filt, s: sort }).toString())));
  bindBrowseSearch("vq", "vocabResultCount", "vocabGrid", function (text) {
    let matches = (DB.vocab[lv] || []).filter(v => matchVQuery(v, text));
    if (filt === "learned") matches = matches.filter(v => isVLearned(v.id));
    else if (filt === "unlearned") matches = matches.filter(v => !isVLearned(v.id));
    else if (filt === "fav") matches = matches.filter(v => isVFav(v.id));
    else if (filt === "nosent") matches = matches.filter(v => !(v.sentences && v.sentences.length));
    if (sort === "freq") matches = Course.sortVocab(matches, courseKanjiFreqMap(), courseKanjiMedian(lv));
    else if (sort === "alpha") matches.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
    else if (sort === "reading") matches.sort((a, b) => (a.reading < b.reading ? -1 : 1));
    else if (sort === "progress") matches.sort((a, b) => ((store.vLearned[a.id] ? 1 : 0) - (store.vLearned[b.id] ? 1 : 0)));
    return matches;
  }, vocabCard, "vocab", lv, link);
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
  const exampleReadings = new Set();
  for (const s of (v.sentences || [])) {
    const rubyRe = /<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/g;
    let match;
    while ((match = rubyRe.exec(s.furi || ""))) {
      const base = match[1].replace(/<[^>]*>/g, "");
      const reading = match[2].replace(/<[^>]*>/g, "");
      if (base === v.word && reading && reading !== v.reading) exampleReadings.add(reading);
    }
  }
  const alternateReadings = Array.from(exampleReadings);
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
    "<div class=\"readings\"><span><span class=\"lab\">Reading </span><span lang=\"ja\">" + esc(v.reading) + "</span></span>" +
    (alternateReadings.length ? "<span><span class=\"lab\">Also read in examples </span><span lang=\"ja\">" + esc(alternateReadings.join("、 ")) + "</span></span>" : "") + "</div>" +
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
      body.innerHTML = quizResultHTML({ kind: "vocab", lv: lv, score: score, total: qs.length, best: Math.max(best, score) });
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
      if (ok) { score++; b.classList.add("correct"); }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === v.id) x.classList.add("correct"); });
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      showQuizAnswer(body, ok, "vocab", v, nx);
    }));
  }
  body.innerHTML = "";
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
    if (!store.gLearned[id]) { store.gLearned[id] = Date.now(); recordStudyItem("grammar", id); }
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
    recordStudyItem("grammar", id);
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
  const query = q.q || "", filt = q.f || "all", sort = q.s || "freq";
  const link = (over) => "#/grammar/" + lv + "?" + new URLSearchParams(Object.assign({ q: query, f: filt, s: sort }, over)).toString();
  let recs = (DB.grammar[lv] || []).slice();
  recs = recs.filter(g => matchGQuery(g, query));
  if (filt === "learned") recs = recs.filter(g => isGLearned(g.id));
  else if (filt === "unlearned") recs = recs.filter(g => !isGLearned(g.id));
  else if (filt === "fav") recs = recs.filter(g => isGFav(g.id));
  if (sort === "freq") recs = Course.sortGrammar(recs);
  else if (sort === "alpha") recs.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
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
    "<option value=\"default\"" + (sort === "default" ? " selected" : "") + ">Dataset order</option>" +
    "<option value=\"freq\"" + (sort === "freq" ? " selected" : "") + ">Most frequent</option>" +
    "<option value=\"alpha\"" + (sort === "alpha" ? " selected" : "") + ">A-Z</option>" +
    "<option value=\"progress\"" + (sort === "progress" ? " selected" : "") + ">Unlearned first</option>" +
    "</select></div>" +
    "<p class=\"result-count\" id=\"grammarResultCount\">" + recs.length + " points &middot; <a href=\"#/review?tab=quiz&kind=grammar&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
    "<div class=\"kanji-grid\" id=\"grammarGrid\">" + grid + "</div>";
  $$(".chip", view).forEach(c => c.addEventListener("click", () => go("#/grammar/" + c.dataset.lv + "?" + new URLSearchParams({ q: query, f: filt, s: sort }).toString())));
  bindBrowseSearch("gq", "grammarResultCount", "grammarGrid", function (text) {
    let matches = (DB.grammar[lv] || []).filter(g => matchGQuery(g, text));
    if (filt === "learned") matches = matches.filter(g => isGLearned(g.id));
    else if (filt === "unlearned") matches = matches.filter(g => !isGLearned(g.id));
    else if (filt === "fav") matches = matches.filter(g => isGFav(g.id));
    if (sort === "freq") matches = Course.sortGrammar(matches);
    else if (sort === "alpha") matches.sort((a, b) => (a.meaning < b.meaning ? -1 : 1));
    else if (sort === "progress") matches.sort((a, b) => ((store.gLearned[a.id] ? 1 : 0) - (store.gLearned[b.id] ? 1 : 0)));
    return matches;
  }, grammarCard, "grammar", lv, link);
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
      body.innerHTML = quizResultHTML({ kind: "grammar", lv: lv, score: score, total: qs.length, best: Math.max(best, score) });
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
      if (ok) { score++; b.classList.add("correct"); }
      else {
        b.classList.add("wrong");
        $$(".quiz-opt", body).forEach(x => { if (x.dataset.k === g.id) x.classList.add("correct"); });
      }
      const nx = document.createElement("button");
      nx.className = "btn primary"; nx.textContent = i + 1 >= qs.length ? "See result" : "Next";
      nx.addEventListener("click", () => { i++; answered = false; draw(); });
      showQuizAnswer(body, ok, "grammar", g, nx);
    }));
  }
  body.innerHTML = "";
  draw();
}
/* ---------- Course: JLPT study plan over existing content ----------
   The plan treats kanji, vocabulary and grammar records as its source of
   truth and stores only references ({ type: type, id: id }) plus plan
   settings in store.course. Learned/SRS maps are shared with the rest of
   the app, so dictionary browsing, review and progress keep working. */
function courseKanjiFreqMap() {
  var map = {};
  LEVELS.forEach(function (lv) {
    (DB.levels[lv] || []).forEach(function (it) {
      if (map[it.k] == null) {
        var f = Number(it.freq);
        map[it.k] = (f > 0) ? f : Infinity;
      }
    });
  });
  return map;
}
function courseKanjiMedian(lv) {
  var freqs = [];
  (DB.levels[lv] || []).forEach(function (it) {
    var f = Number(it.freq);
    if (f > 0) freqs.push(f);
  });
  return Course.median(freqs);
}
function courseLists(lv) {
  var kanjiRecs = Course.sortKanji(DB.levels[lv] || []);
  var vocabRecs = Course.sortVocab(DB.vocab[lv] || [], courseKanjiFreqMap(), courseKanjiMedian(lv));
  var grammarRecs = Course.sortGrammar(DB.grammar[lv] || []);
  return {
    kanji: kanjiRecs.map(function (it) { return it.k; }),
    vocab: vocabRecs.map(function (v) { return v.id; }),
    grammar: grammarRecs.map(function (g) { return g.id; })
  };
}
function courseCurriculum() {
  if (!store.course || typeof Course === "undefined") return [];
  return Course.buildCurriculum(courseLists(store.course.target), store.course.dailyNew, store.course.weights);
}
function courseUnlockedDay() {
  if (!store.course) return 1;
  return Math.max(1, store.course.unlockedDay || 1);
}
function courseUnlockDay(n) {
  if (!store.course) return;
  var total = courseCurriculum().length;
  store.course.unlockedDay = Math.max(1, Math.min(n, total + 1));
  save();
}
function courseUnlocked() {
  return Course.unlockedForDay(courseCurriculum(), courseUnlockedDay());
}
function courseSchedule() {
  if (!store.course) return { state: "no-date", behind: 0, calLeft: null, curLeft: 0, total: 0, day: 1 };
  var total = courseCurriculum().length;
  var day = Math.min(courseUnlockedDay(), total + 1);
  var curLeft = Math.max(0, total - day + 1);
  var calLeft = store.course.examDate ? Course.daysUntil(store.course.examDate, Course.todayStr()) : null;
  var s = Course.scheduleStatus(curLeft, calLeft);
  s.calLeft = calLeft; s.curLeft = curLeft; s.total = total; s.day = day;
  return s;
}
function courseScheduleText() {
  if (!store.course) return "";
  var s = courseSchedule(), c = store.course;
  if (s.state === "done") return "all material unlocked";
  if (s.state === "no-date") return "no fixed exam date - steady pace";
  if (s.state === "passed") return "exam date passed - studying at your own pace";
  var label = esc(c.examLabel || "exam");
  if (s.state === "on-track") return s.calLeft + " days until " + label + " - on track";
  return s.behind + " days of material behind exam pace - nothing is lost, continue when ready";
}
function courseIsLearned(type, id) {
  if (type === "kanji") return !!store.learned[id];
  if (type === "vocab") return !!((store.vLearned || {})[id]);
  return !!((store.gLearned || {})[id]);
}
function courseSrsOf(type, id) {
  var map = type === "kanji" ? store.srs : type === "vocab" ? (store.vSrs || {}) : (store.gSrs || {});
  var s = map[id];
  if (!s) return { isLearned: courseIsLearned(type, id), inSrs: false, box: 0, isDue: false };
  return { isLearned: courseIsLearned(type, id), inSrs: true, box: s.box || 0, isDue: (s.due || 0) <= Date.now() };
}
function courseStateOf(item) { return Course.classifyItem(courseSrsOf(item.type, item.id)); }
function courseReviewDue() {
  var un = courseUnlocked(), out = [];
  [["kanji", un.kanji], ["vocab", un.vocab], ["grammar", un.grammar]].forEach(function (pair) {
    pair[1].forEach(function (id) {
      var s = courseSrsOf(pair[0], id);
      if (s.inSrs && s.isDue) out.push({ type: pair[0], id: id });
    });
  });
  return out;
}
function courseRecordDay() {
  if (!store.course) return;
  store.course.studyDays = Course.recordStudyDay(store.course.studyDays || [], Course.todayStr());
}
function courseMarkStudied(type, id) {
  var wasLearned = courseIsLearned(type, id);
  if (type === "kanji") store.learned[id] = store.learned[id] || Date.now();
  else if (type === "vocab") { store.vLearned = store.vLearned || {}; store.vLearned[id] = store.vLearned[id] || Date.now(); }
  else { store.gLearned = store.gLearned || {}; store.gLearned[id] = store.gLearned[id] || Date.now(); }
  if (!wasLearned) recordStudyItem(type, id);
  var map = type === "kanji" ? store.srs : type === "vocab" ? (store.vSrs || {}) : (store.gSrs || {});
  if (!map[id]) map[id] = { box: 1, due: Date.now() + 864e5 };
  courseRecordDay();
  courseCheckMilestones();
  save();
}
function courseGrade(type, id, ok) {
  if (type === "kanji") srsGrade(id, ok);
  else if (type === "vocab") vSrsGrade(id, ok);
  else gSrsGrade(id, ok);
  courseRecordDay();
  save();
}
function courseLevelCounts(lv) {
  var l = courseLists(lv);
  return { kanji: l.kanji.length, vocab: l.vocab.length, grammar: l.grammar.length };
}
function courseCompletionPct() {
  if (!store.course) return 0;
  return Course.courseCompletion(courseLists(store.course.target), courseIsLearned).pct;
}
function courseMilestoneStats() {
  var c = store.course, lists = courseLists(c.target);
  var vk = 0, kk = 0, i;
  for (i = 0; i < lists.vocab.length; i++) if (courseIsLearned("vocab", lists.vocab[i])) vk++;
  for (i = 0; i < lists.kanji.length; i++) if (courseIsLearned("kanji", lists.kanji[i])) kk++;
  var days = c.studyDays || [];
  return { studyDays: days.length, streak: Course.calcStreak(days, Course.todayStr()),
    vocabLearned: vk, kanjiLearned: kk, perfectQuiz: !!c.perfectQuiz, coursePct: courseCompletionPct() };
}
function courseCheckMilestones() {
  if (!store.course) return [];
  var fresh = Course.checkMilestones(courseMilestoneStats(), store.course.milestones || []);
  if (fresh.length) { store.course.milestones = (store.course.milestones || []).concat(fresh); save(); }
  return fresh;
}
function courseTypeName(type) { return type === "kanji" ? "Kanji" : type === "vocab" ? "Vocabulary" : "Grammar"; }
function courseItemLink(type, id) {
  if (type === "kanji") return "#/k/" + encodeURIComponent(id);
  if (type === "vocab") return "#/v/" + encodeURIComponent(id);
  return "#/g/" + encodeURIComponent(id);
}
function courseItemLabel(type, id) {
  if (type === "kanji") {
    var e = DB.byChar[id];
    return { head: id, sub: e ? e.item.meaning : "" };
  }
  if (type === "vocab") {
    var v = (DB.vById || {})[id];
    return { head: v ? v.word : id, sub: v ? ((v.reading ? v.reading + " - " : "") + v.meaning) : "" };
  }
  var g = (DB.gById || {})[id];
  return { head: g ? g.point : id, sub: g ? g.meaning : "" };
}
function courseItemRow(type, id, showStudy) {
  var lb = courseItemLabel(type, id);
  var done = courseIsLearned(type, id);
  return "<div class=\"course-item" + (done ? " done" : "") + "\">" +
    "<a href=\"" + courseItemLink(type, id) + "\"><span class=\"course-item-head" + (type === "kanji" ? "" : " jp") + "\"" +
    (type === "kanji" ? "" : " lang=\"ja\"") + ">" + esc(lb.head) + "</span>" +
    "<span class=\"course-item-sub\">" + esc(lb.sub) + "</span></a>" +
    (done ? "<span class=\"course-item-badge\">Studied</span>"
      : (showStudy ? "<button class=\"btn soft\" data-study=\"" + type + ":" + esc(id) + "\">Mark studied</button>" : "")) +
    "</div>";
}
function courseMilestoneHTML() {
  if (!store.course) return "";
  var earned = store.course.milestones || [];
  return "<div class=\"mile-grid\">" + Course.MILESTONES.map(function (m) {
    var got = earned.indexOf(m.id) >= 0;
    return "<span class=\"mile" + (got ? " got\" title=\"Earned" : "\" title=\"Locked") + "\">" +
      (got ? "&#10003; " : "") + esc(m.label) + "</span>";
  }).join("") + "</div>";
}
function courseSettingsCard() {
  if (typeof Course === "undefined") return "";
  var inner;
  if (!store.course) {
    inner = "<p class=\"explain\">No study plan yet. A plan unlocks a little new material every day and quizzes you on it.</p>" +
      "<p><a class=\"btn soft\" href=\"#/course/setup\">Create study plan</a></p>";
  } else {
    var c = store.course;
    var planTxt = c.target + ", " + c.dailyNew + " new items/day" +
      (c.examDate ? ", exam " + esc(c.examLabel || c.examDate) : ", no fixed exam date");
    inner = "<p class=\"explain\">Current plan: " + planTxt + ".</p>" +
      "<p><a class=\"btn soft\" href=\"#/course/setup\">Change plan</a> " +
      "<a class=\"btn soft\" href=\"#/course/reset\">End plan</a></p>";
  }
  return "<div class=\"card\"><h2>Study plan</h2>" + inner + "</div>";
}
function renderCourse(view, sub, q) {
  if (typeof Course === "undefined") {
    view.innerHTML = "<h1>Study plan</h1><p class=\"empty\">The course module did not load. Reload the page.</p>";
    return;
  }
  if (sub === "reset") {
    if (store.course && confirm("End your study plan? Your learned items and reviews stay, only the plan is removed.")) {
      store.course = null; save();
    }
    go("#/"); return;
  }
  if (!sub) { go("#/"); return; }
  if (!store.course && sub !== "setup") { go("#/course/setup"); return; }
  if (sub === "setup") renderCourseSetup(view, q || {});
  else if (sub === "day") renderCourseDay(view);
  else if (sub === "quiz") renderCourseQuiz(view);
  else go("#/");
}
function renderCourseSetup(view, q) {
  q = q || {};
  var preset = LEVELS.indexOf(String(q.target || "").toUpperCase()) >= 0 ? String(q.target).toUpperCase() : null;
  var sel = { target: preset || (store.course && store.course.target) || "N3",
    examDate: (store.course && store.course.examDate) || "",
    pace: "recommended", custom: (store.course && store.course.dailyNew) || 20 };
  if (LEVELS.indexOf(sel.target) < 0) sel.target = "N3";
  var exams = Course.upcomingExams(Course.todayStr(), 4);
  function levelChips() {
    return LEVELS.map(function (l) {
      return "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === sel.target) + "\">" + l + "</button>";
    }).join("");
  }
  function examRows() {
    var rows = exams.map(function (e) {
      var left = Course.daysUntil(e.date, Course.todayStr());
      var checked = sel.examDate === e.date ? " checked" : "";
      return "<label class=\"exam-row\"><input type=\"radio\" name=\"exam\" value=\"" + e.date + "\"" + checked + "> " +
        esc(e.label) + " <small>(" + left + " days remaining)</small></label>";
    }).join("");
    rows += "<label class=\"exam-row\"><input type=\"radio\" name=\"exam\" value=\"\"" +
      (sel.examDate ? "" : " checked") + "> No specific exam date</label>";
    return rows;
  }
  view.innerHTML =
    "<h1>" + (store.course ? "Change study plan" : "Create study plan") + "</h1>" +
    "<div class=\"card\"><h2>1. Which JLPT test are you preparing for?</h2>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"Target level\">" + levelChips() + "</div></div>" +
    "<div class=\"card\"><h2>2. Target exam date</h2><div id=\"examBox\">" + examRows() + "</div>" +
    "<p class=\"explain\">Exam sessions are generated from the usual first-Sunday-of-July/December rhythm and need no network. You can change the target later.</p></div>" +
    "<div class=\"card\"><h2>3. Daily pace</h2><div id=\"paceBox\"></div>" +
    "<p class=\"explain\">The suggestion below is computed from the actual " + "content. Pick whatever fits your life.</p></div>" +
    "<p><button class=\"btn primary\" id=\"planStart\">" + (store.course ? "Save plan" : "Start plan") + "</button> " +
    "<a class=\"btn soft\" href=\"#/\">Cancel</a></p>";
  function refreshPace() {
    var counts = courseLevelCounts(sel.target);
    var days = sel.examDate ? Course.daysUntil(sel.examDate, Course.todayStr()) : null;
    var pace = Course.suggestPace(counts, days);
    function opt(v, label) {
      return "<label class=\"exam-row\"><input type=\"radio\" name=\"pace\" value=\"" + v + "\"" +
        (sel.pace === v ? " checked" : "") + "> " + label + "</label>";
    }
    $("#paceBox").innerHTML =
      "<p class=\"explain\">" +
      (days == null ? "No fixed exam date. " : "About " + days + " days until the exam. ") +
      "To cover the " + pace.total + " planned " + sel.target + " items, we suggest about " +
      "<b>" + pace.recommended + " new items per day</b>. You can choose a different pace.</p>" +
      opt("relaxed", "Relaxed - " + pace.relaxed + "/day") +
      opt("recommended", "Recommended - " + pace.recommended + "/day") +
      opt("intensive", "Intensive - " + pace.intensive + "/day") +
      "<label class=\"exam-row\"><input type=\"radio\" name=\"pace\" value=\"custom\"" +
      (sel.pace === "custom" ? " checked" : "") + "> Custom: " +
      "<input type=\"number\" id=\"paceCustom\" min=\"5\" max=\"100\" value=\"" + sel.custom + "\" aria-label=\"Custom items per day\"> /day</label>";
    $$("input[name=pace]", view).forEach(function (r) {
      r.addEventListener("change", function () { sel.pace = r.value; });
    });
    $("#paceCustom").addEventListener("input", function (e) {
      sel.custom = parseInt(e.target.value, 10) || sel.custom;
      sel.pace = "custom";
      var cr = $("input[name=pace][value=custom]", view);
      if (cr) cr.checked = true;
    });
    view.dataset.rec = pace.recommended;
    view.dataset.rel = pace.relaxed;
    view.dataset.int = pace.intensive;
  }
  $$("[data-lv]", view).forEach(function (ch) {
    ch.addEventListener("click", function () {
      sel.target = ch.dataset.lv;
      $$("[data-lv]", view).forEach(function (x) { x.setAttribute("aria-pressed", x === ch ? "true" : "false"); });
      refreshPace();
    });
  });
  $$("input[name=exam]", view).forEach(function (r) {
    r.addEventListener("change", function () { sel.examDate = r.value; refreshPace(); });
  });
  refreshPace();
  $("#planStart").addEventListener("click", function () {
    var paceVal = sel.pace === "custom" ? sel.custom
      : sel.pace === "relaxed" ? parseInt(view.dataset.rel, 10)
      : sel.pace === "intensive" ? parseInt(view.dataset.int, 10)
      : parseInt(view.dataset.rec, 10);
    paceVal = Math.max(5, Math.min(100, paceVal || 20));
    var label = "";
    for (var i = 0; i < exams.length; i++) if (exams[i].date === sel.examDate) label = exams[i].label;
    var isNew = !store.course || store.course.target !== sel.target;
    var keep = store.course || Course.defaultCourse(sel.target);
    store.course = { target: sel.target, examId: sel.examDate, examLabel: label, examDate: sel.examDate,
      startDate: isNew ? Course.todayStr() : keep.startDate,
      dailyNew: paceVal, weights: keep.weights || Course.defaultCourse("N3").weights,
      unlockedDay: isNew ? 1 : (keep.unlockedDay || 1),
      studyDays: keep.studyDays || [], milestones: isNew ? [] : (keep.milestones || []),
      quizzes: keep.quizzes || 0, perfectQuiz: !!keep.perfectQuiz };
    save();
    go("#/");
  });
}
function renderCourseDay(view) {
  var c = store.course, cur = courseCurriculum();
  var day = Math.min(courseUnlockedDay(), cur.length + 1);
  if (day > cur.length) {
    var fresh = courseCheckMilestones();
    view.innerHTML = "<h1>Course complete</h1>" +
      "<div class=\"card\"><h2>You unlocked everything</h2>" +
      "<p class=\"explain\">All " + esc(c.target) + " material is unlocked. Keep reviewing and quizzing to lock it in.</p>" +
      (fresh.length ? "<p class=\"explain\">New milestone" + (fresh.length > 1 ? "s" : "") + ": " +
        fresh.map(function (id) { return esc(Course.milestoneLabel(id)); }).join(", ") + "</p>" : "") +
      "<p><a class=\"btn primary\" href=\"#/course/quiz\">Daily quiz</a> " +
      "<a class=\"btn soft\" href=\"#/review\">Review</a></p></div>" +
      "<div class=\"card\"><h2>Milestones</h2>" + courseMilestoneHTML() + "</div>";
    return;
  }
  var today = cur[day - 1];
  var due = courseReviewDue();
  var dueShown = due.slice(0, 30);
  var earlier = Course.unlockedForDay(cur, day - 1);
  var backlog = earlier.all.filter(function (it) { return !courseIsLearned(it.type, it.id); });
  var backlogShown = backlog.slice(0, 20);
  var todays = [];
  ["kanji", "vocab", "grammar"].forEach(function (t) {
    (today[t] || []).forEach(function (id) { todays.push({ type: t, id: id }); });
  });
  var todayDone = todays.length > 0 && todays.every(function (it) { return courseIsLearned(it.type, it.id); });
  var nextLabel = day >= cur.length ? "Finish course" : "Continue to day " + (day + 1);
  function section(type, ids) {
    if (!ids.length) return "";
    return "<h3>" + courseTypeName(type) + " (" + ids.length + ")</h3>" +
      ids.map(function (id) { return courseItemRow(type, id, true); }).join("");
  }
  view.innerHTML =
    "<h1>Day " + day + " of " + cur.length + "</h1>" +
    "<p class=\"explain\">Missed days never skip material: this batch stays until you study it. " +
    "New in this batch: " + today.kanji.length + " kanji, " + today.vocab.length +
    " vocabulary, " + today.grammar.length + " grammar, most frequent first. " +
    "Tap an item to study it, then mark it studied.</p>" +
    (todayDone ? "<div class=\"card\"><h2>Batch complete</h2>" +
      "<p class=\"explain\">Nice studying. Unlock the next batch whenever you are ready.</p>" +
      "<p><button class=\"btn primary\" data-next=\"1\">" + nextLabel + "</button></p></div>" : "") +
    section("kanji", today.kanji) + section("vocab", today.vocab) + section("grammar", today.grammar) +
    (backlog.length ? "<div class=\"card\"><h2>Still to study from earlier batches (" + backlog.length + ")</h2>" +
      backlogShown.map(function (it) { return courseItemRow(it.type, it.id, true); }).join("") +
      (backlog.length > backlogShown.length ? "<p class=\"explain\">+" + (backlog.length - backlogShown.length) + " more - they also appear in the daily quiz.</p>" : "") + "</div>" : "") +
    "<div class=\"card\"><h2>Due for review (" + due.length + ")</h2>" +
    (due.length ? dueShown.map(function (it) { return courseItemRow(it.type, it.id, false); }).join("") +
      (due.length > dueShown.length ? "<p class=\"explain\">+" + (due.length - dueShown.length) + " more in Review.</p>" : "")
      : "<p class=\"explain\">Nothing due. Newly studied items appear here when their review comes up.</p>") + "</div>" +
    "<p><a class=\"btn primary\" href=\"#/course/quiz\">Start daily quiz</a> " +
    (todayDone ? "" : "<button class=\"btn soft\" data-next=\"1\">Unlock day " + (day + 1) + " early</button> ") +
    "<a class=\"btn soft\" href=\"#/\">Dashboard</a></p>";
  $$("[data-next]", view).forEach(function (b) {
    b.addEventListener("click", function () { courseUnlockDay(day + 1); renderCourseDay(view); });
  });
  $$("[data-study]", view).forEach(function (b) {
    b.addEventListener("click", function () {
      var idx = b.dataset.study.indexOf(":");
      courseMarkStudied(b.dataset.study.slice(0, idx), b.dataset.study.slice(idx + 1));
      renderCourseDay(view);
    });
  });
}

function courseBuildQuestion(item, lv) {
  var v = Math.floor(Math.random() * 3);
  if (item.type === "kanji") {
    var e = DB.byChar[item.id];
    if (!e) return null;
    var pool = (DB.levels[lv] || []).filter(function (x) { return x.k !== item.id; });
    var others = shuffle(pool).slice(0, 3);
    if (!others.length) return null;
    return { type: "kanji", id: item.id, variant: v % 3, opts: shuffle([e.item].concat(others)), head: e.item };
  }
  if (item.type === "vocab") {
    var rec = (DB.vById || {})[item.id];
    if (!rec) return null;
    var vpool = (DB.vocab[lv] || []).filter(function (x) { return x.id !== item.id; });
    var vothers = shuffle(vpool).slice(0, 3);
    if (!vothers.length) return null;
    return { type: "vocab", id: item.id, variant: v % 2, opts: shuffle([rec].concat(vothers)), head: rec };
  }
  var g = (DB.gById || {})[item.id];
  if (!g) return null;
  var gpool = (DB.grammar[lv] || []).filter(function (x) { return x.id !== item.id; });
  var gothers = shuffle(gpool).slice(0, 3);
  if (!gothers.length) return null;
  return { type: "grammar", id: item.id, variant: v % 2, opts: shuffle([g].concat(gothers)), head: g };
}
function courseQuizKey(q, o) {
  if (q.type === "kanji") return o.k;
  return o.id;
}
function courseQuizPrompt(q) {
  if (q.type === "kanji") {
    if (q.variant === 0) return "What does this mean?<span class=\"big\" lang=\"ja\">" + esc(q.head.k) + "</span>";
    if (q.variant === 1) return "Which kanji means \u201c" + esc(q.head.meaning) + "\u201d?";
    return "Which kanji reads \u201c" + esc(q.head.on[0] || q.head.kun[0] || "?") + "\u201d?";
  }
  if (q.type === "vocab") {
    if (q.variant === 0) return "What does this word mean?<span class=\"big\" lang=\"ja\">" + esc(q.head.word) + "</span>" +
      (q.head.reading ? "<span class=\"explain\" lang=\"ja\">" + esc(q.head.reading) + "</span>" : "");
    return "Which word means \u201c" + esc(q.head.meaning) + "\u201d?";
  }
  if (q.variant === 0) return "What does this mean?<span class=\"big jp gram-big\" lang=\"ja\">" + esc(q.head.point) + "</span>";
  return "Which grammar point means: " + esc(q.head.meaning) + "?";
}
function courseQuizOptionLabel(q, o) {
  if (q.type === "kanji") return q.variant === 0 ? o.meaning : o.k;
  if (q.type === "vocab") return q.variant === 0 ? o.meaning : (o.word + (o.reading && o.reading !== o.word ? " (" + o.reading + ")" : ""));
  return q.variant === 0 ? o.meaning : o.point;
}
function courseQuizHeadLabel(q) {
  if (q.type === "kanji") return q.head.k + " = " + q.head.meaning;
  if (q.type === "vocab") return q.head.word + " = " + q.head.meaning;
  return q.head.point + " = " + q.head.meaning;
}
function renderCourseQuiz(view) {
  var c = store.course, un = courseUnlocked();
  if (!un.total) {
    view.innerHTML = "<h1>Daily quiz</h1><p class=\"empty\">Nothing unlocked yet. Study day 1 first.</p>" +
      "<p><a class=\"btn soft\" href=\"#/course/day\">Study today</a></p>";
    return;
  }
  var picked = Course.selectQuizItems(un.all, courseStateOf, 10);
  var qs = [];
  picked.forEach(function (it) {
    var built = courseBuildQuestion(it, c.target);
    if (built) qs.push(built);
  });
  if (!qs.length) {
    view.innerHTML = "<h1>Daily quiz</h1><p class=\"empty\">Not enough material to build a quiz yet.</p>";
    return;
  }
  var i = 0, score = 0, answered = false;
  view.innerHTML = "<h1>Daily quiz</h1><div id=\"cqBody\"></div>";
  var body = $("#cqBody");
  function draw() {
    if (i >= qs.length) { finish(); return; }
    var cur = qs[i];
    var needJp = !(cur.type === "kanji" && cur.variant === 0) && !(cur.type === "vocab" && cur.variant === 0) && !(cur.type === "grammar" && cur.variant === 0);
    var opts = cur.opts.map(function (o) {
      return "<button class=\"btn quiz-opt" + (needJp ? " jp" : "") + "\" data-ck=\"" + esc(courseQuizKey(cur, o)) + "\"" +
        (needJp ? " lang=\"ja\"" : "") + ">" + esc(courseQuizOptionLabel(cur, o)) + "</button>";
    }).join("");
    body.innerHTML =
      "<p class=\"explain\">" + esc(c.target) + " daily quiz &middot; question " + (i + 1) + " of " + qs.length + " &middot; score " + score +
      " &middot; " + courseTypeName(cur.type) + "</p>" +
      "<div class=\"card\"><p class=\"quiz-q\">" + courseQuizPrompt(cur) + "</p><div class=\"quiz-opts\">" + opts + "</div>" +
      "<p id=\"qFb\" class=\"explain\"></p></div>";
    $$(".quiz-opt", body).forEach(function (b) {
      b.addEventListener("click", function () {
        if (answered) return;
        answered = true;
        var ok = b.dataset.ck === cur.id;
        courseGrade(cur.type, cur.id, ok);
        if (ok) {
          score++;
          b.classList.add("correct");
        } else {
          b.classList.add("wrong");
          $$(".quiz-opt", body).forEach(function (x) { if (x.dataset.ck === cur.id) x.classList.add("correct"); });
        }
        var nx = document.createElement("button");
        nx.className = "btn primary";
        nx.textContent = i + 1 >= qs.length ? "See result" : "Next";
        nx.addEventListener("click", function () { i++; answered = false; draw(); });
        showQuizAnswer(body, ok, cur.type, cur.head, nx);
      });
    });
  }
  function finish() {
    c.quizzes = (c.quizzes || 0) + 1;
    if (score === qs.length && qs.length > 0) c.perfectQuiz = true;
    courseRecordDay();
    var fresh = courseCheckMilestones();
    save();
    var good = qs.length > 0 && score / qs.length >= 0.7;
    body.innerHTML = "<div class=\"card quiz-result " + (good ? "good" : "study") + "\">" +
      "<img class=\"quiz-result-img\" src=\"assets/" + (good ? "pengo-happy.png" : "pengo-study.png") + "\" alt=\"Pengo\">" +
      "<h2>" + (score === qs.length ? "Perfect score!" : good ? "Nice studying!" : "Good effort") + "</h2>" +
      "<p class=\"quiz-score\">" + score + " / " + qs.length + "</p>" +
      "<p class=\"explain\">Daily quiz for your " + esc(c.target) + " plan. Weak and newly unlocked items show up more often; mastered ones still visit sometimes.</p>" +
      (fresh.length ? "<p class=\"explain\">New milestone" + (fresh.length > 1 ? "s" : "") + ": " +
        fresh.map(function (id) { return esc(Course.milestoneLabel(id)); }).join(", ") + "</p>" : "") +
      "<p><button class=\"btn primary\" id=\"cqRetry\">Retry</button> " +
      "<a class=\"btn soft\" href=\"#/course/day\">Study today</a> " +
      "<a class=\"btn soft\" href=\"#/\">Dashboard</a></p></div>";
    $("#cqRetry").addEventListener("click", function () { renderCourseQuiz(view); });
  }
  draw();
}

/* ---------- Theme, search box, init ---------- */
function applyTheme() {
  const dark = store.settings.theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (window.Platform && window.Platform.setDarkTheme) window.Platform.setDarkTheme(dark);
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
window.KKBack = () => {
  if (typeof window.OBBack === "function" && window.OBBack()) return true;
  return window.Platform ? window.Platform.handleBackPress() : false;
};
try {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      if (!window.Platform.handleBackPress()) window.Capacitor.Plugins.App.exitApp();
    });
  }
} catch (e) { /* web: no native back handler */ }
function clearBootGate() { try { document.documentElement.classList.remove("ob-boot"); } catch (e) {} }
function bootFailed() { clearBootGate(); $("#view").innerHTML = "<p class=\"empty\">Could not load data files. Serve this folder over HTTP (e.g. <code>python -m http.server</code>) and open it again — browsers block data files on file:// URLs.</p>"; }
var bootData = loadData();
var bootOnboard = false;
try { bootOnboard = (typeof shouldShowOnboarding === "function") && shouldShowOnboarding(); } catch (e) { bootOnboard = false; }
if (bootOnboard) {
  initChrome();
  showOnboarding(() => { bootData.then(() => { clearBootGate(); render(); }).catch(bootFailed); });
  bootData.catch(() => {});
} else {
  clearBootGate();
  bootData.then(() => { initChrome(); render(); }).catch(bootFailed);
}
