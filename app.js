"use strict";
/* Pengo - data-driven JLPT study app (no build step).
   Data: data/n5..n1.json + data/radicals.json + data/meta.json (see scripts/build_data.py).
   Vocab: data/vocab_n5..n1.json + data/vocab_meta.json (see scripts/build_vocab.py).
   Grammar: data/grammar_n5..n1.json + data/grammar_meta.json (see scripts/build_grammar.py).
   Pengo progress: localStorage key "pengo:v1". */

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const STORE_KEY = "pengo:v1";
// Read only to migrate progress saved before the Pengo rename on the same origin.
const LEGACY_STORE_KEY = "knowkanji:v1";
const STROKE_BASE = "resources/stroke-order/kanjivg/";

const DB = { levels: {}, byChar: {}, vocab: {}, vById: {}, grammar: {}, gById: {}, meta: null, vocabMeta: null, grammarMeta: null, radicals: [], loaded: false };

const defaultStore = () => ({ learned: {}, fav: [], notes: {}, srs: {}, vLearned: {}, vFav: [], vNotes: {}, vSrs: {}, gLearned: {}, gFav: [], gNotes: {}, gSrs: {},
  settings: { theme: "light", dailyGoal: 5, autoplay: true, hideBanner: false }, quizBest: {}, vQuizBest: {}, gQuizBest: {}, course: null,
  study: { days: {}, loggedLearned: {} }, practice: { session: null, pausedSession: null, returnSession: null, history: [], badges: [], mistakes: {} } });

let store = defaultStore();
try {
  let raw = localStorage.getItem(STORE_KEY);
  const migrate = raw === null;
  if (migrate) raw = localStorage.getItem(LEGACY_STORE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid progress");
    store = Object.assign(defaultStore(), parsed);
    if (migrate) {
      // Keep progress usable in memory even if storage is full or unavailable.
      try {
        localStorage.setItem(STORE_KEY, raw);
        localStorage.removeItem(LEGACY_STORE_KEY);
      } catch (e) { /* save() will report a persistent storage failure */ }
    }
  }
} catch (e) { /* fresh start */ }
store.settings = Object.assign(defaultStore().settings, store.settings || {});
store.settings.dailyGoal = Practice.goal(store.settings.dailyGoal);
delete store.settings.audioEngine;
store.practice = Practice.normalize(store.practice);
if (store.settings.hideBanner == null) store.settings.hideBanner = false;
for (const _k of ["vLearned", "vNotes", "vSrs", "vQuizBest", "gLearned", "gNotes", "gSrs", "gQuizBest"]) if (!store[_k]) store[_k] = {};
if (!store.vFav) store.vFav = [];
if (!store.gFav) store.gFav = [];
if (!store.study || typeof store.study !== "object") store.study = { days: {}, loggedLearned: {} };
if (!store.study.days || typeof store.study.days !== "object") store.study.days = {};
if (!store.study.loggedLearned || typeof store.study.loggedLearned !== "object") store.study.loggedLearned = {};
var storageWarningShown = false;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
  catch (e) {
    if (!storageWarningShown) {
      storageWarningShown = true;
      var notice = document.createElement("p");
      notice.className = "storage-notice"; notice.setAttribute("role", "status");
      notice.textContent = "Progress cannot be saved on this device. Export a backup from Settings before closing Pengo.";
      document.body.appendChild(notice);
    }
    return false;
  }
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
  var day = studyDay(studyDateKey(new Date()));
  day.learned++;
  if (!day.practiced) day.practiced = {};
  day.practiced[key] = true;
  courseRecordDay();
  updatePracticeBadges();
  courseCheckMilestones();
  Reminders.syncGoal();
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
      var day = studyDay(studyDateKey(date));
      day.learned++;
      day.practiced = day.practiced || {};
      day.practiced[itemKey] = true;
    });
  });
  store.study.migratedLearned = true;
  save();
}
migrateStudyItems();
normalizePracticeDays();
function normalizePracticeDays() {
  var legacy = {};
  Object.keys(store.study.days).forEach(function (date) {
    var day = store.study.days[date];
    if (!day || typeof day !== "object" || Array.isArray(day)) { delete store.study.days[date]; return; }
    if (!day.practiced || typeof day.practiced !== "object" || Array.isArray(day.practiced)) {
      day.practiced = {}; legacy[date] = true;
    }
  });
  [["kanji", store.learned], ["vocab", store.vLearned], ["grammar", store.gLearned]].forEach(function (pair) {
    Object.keys(pair[1]).forEach(function (id) {
      var stamp = pair[1][id];
      if (typeof stamp !== "number") return;
      var date = studyDateKey(new Date(stamp));
      if (legacy[date]) store.study.days[date].practiced[pair[0] + ":" + id] = true;
    });
  });
  Object.keys(legacy).forEach(function (date) {
    var day = store.study.days[date];
    day.legacyLearned = Math.max(0, (Number(day.learned) || 0) - Object.keys(day.practiced).length);
  });
}

var studyTimeTick = Date.now();
var studyWasVisible = document.visibilityState !== "hidden";
var progressStatsTimer = null;
function flushStudyTime() {
  var now = Date.now(), elapsed = Math.min(30, Math.max(0, Math.floor((now - studyTimeTick) / 1000)));
  studyTimeTick = now;
  if (elapsed && studyWasVisible && !document.body.classList.contains('ob-open') && !(window.OnboardingTour && OnboardingTour.active)) {
    studyDay(studyDateKey(new Date(now))).seconds += elapsed;
    save();
  }
  studyWasVisible = document.visibilityState !== "hidden";
  if (DB.loaded && (!location.hash || location.hash === '#/') && typeof homeDate !== 'undefined' && homeDate !== Course.todayStr()) render();
}
setInterval(flushStudyTime, 15000);
document.addEventListener("visibilitychange", flushStudyTime);
window.addEventListener("pagehide", flushStudyTime);

function exportBackup() {
  const text = JSON.stringify(store);
  if (window.PengoNative && typeof window.PengoNative.exportJson === "function") {
    window.PengoNative.exportJson("pengo-backup.json", text);
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
    if (window.PengoNative && typeof window.PengoNative.showMessage === "function") window.PengoNative.showMessage(text);
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
    store.settings.dailyGoal = Practice.goal(store.settings.dailyGoal);
    delete store.settings.audioEngine;
    store.practice = Practice.normalize(data.practice);
    migrateStudyItems();
    normalizePracticeDays();
    save(); applyTheme(); Reminders.syncGoal(); render();
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
    return { text: story, notice: "A story to help you remember, not the kanji’s origin." };
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
  if (item.mnemonic) return { text: item.mnemonic, notice: "A story to help you remember, not the kanji’s origin." };
  return KanjiMnemonic.generate({ kanji: item.k, meaning: item.meaning,
    parts: learningComponents(item).map(c => c.m), on: item.on, kun: item.kun });
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
  for (const k of Object.keys(store.srs)) if (store.srs[k].due <= now && DB.byChar[k] && inStudyLevel("kanji", k)) n++;
  for (const k of Object.keys(store.vSrs || {})) if (store.vSrs[k].due <= now && DB.vById[k] && inStudyLevel("vocab", k)) n++;
  for (const k of Object.keys(store.gSrs || {})) if (store.gSrs[k].due <= now && DB.gById[k] && inStudyLevel("grammar", k)) n++;
  return n;
}

/* ---------- Router ---------- */
const NAV = [
  { path: "#/", label: "Home", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z\"/></svg>", match: "home" },
  { path: "#/learn", label: "Learn", ico: "<svg viewBox=\"0 0 24 24\"><path d=\"M12 7v14M12 7C9 4 5 4 2 5v14c4-1 7 0 10 2m0-14c3-3 7-3 10-2v14c-4-1-7 0-10 2\"/></svg>", match: "learn" },
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
    q[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent((v || "").replace(/\+/g, " "));
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
  $("#bottomNav").innerHTML = NAV.filter(n => ["home", "learn", "progress", "settings"].indexOf(n.match) >= 0).map(n =>
    "<a href=\"" + n.path + "\"" + (n.match === active ? " aria-current=\"page\"" : "") + ">" +
    "<span class=\"ico\" aria-hidden=\"true\">" + n.ico + "</span><span>" + n.label + "</span></a>").join("");
  const d = dueCount();
  const pill = $("#duePill");
  if (d > 0) { pill.hidden = false; pill.innerHTML = '<a href="#/learn?section=quiz&mode=due">' + d + ' due</a>'; }
  else pill.hidden = true;
}
async function render() {

  if (!DB.loaded) { $("#view").innerHTML = "<p class=\"empty\">Loading kanji data...</p>"; return; }
  const { seg, q } = parseHash();
  if (q.introTour === '1' && !(window.OnboardingTour && OnboardingTour.active)) {
    history.replaceState(history.state, '', '#/'); render(); return;
  }
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
    if (q.kind === "vocab") go("#/learn?section=quiz&tab=quiz&kind=vocab");
    else if (q.kind === "grammar") go("#/learn?section=quiz&tab=quiz&kind=grammar");
    else go("#/learn?section=quiz&tab=quiz");
  }
  else if (name === "course") { renderNav("home"); renderCourse(view, seg[1], q); }
  else if (name === "flashcards") { renderNav("learn"); renderFlashcards(view, q); }
  else if (name === "practice" || name === "review") {
    const target = q.format === "recall" ? "#/flashcards?" : "#/learn?section=quiz&";
    history.replaceState(history.state, '', target + new URLSearchParams(q).toString()); render(); return;
  }
  else if (name === "search") { renderNav("search"); renderSearch(view, q); }
  else if (name === "progress") { renderNav("progress"); renderProgress(view); }
  else if (name === "today") { renderNav("home"); renderTodayItems(view, q); }
  else if (name === "settings") { renderNav("settings"); renderSettings(view); }
  else { renderNav("home"); renderHome(view); }
  bindPageBack(view, name);
  bindLearningCardReturn(view, q, name);
  bindPengoUI(view);
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (name === "learn" && q.section === "quiz" && !q.start && !q.resume) $("#learnQuizzes", view).scrollIntoView({block:"start"});
  if (name === "settings" && q.section === "plan") $("#studyPlanSettings",view).scrollIntoView({block:"start"});
  if (name === "settings" && q.section === "reminders") $("#reminderSettings",view).scrollIntoView({block:"start"});
  if (window.OnboardingTour) OnboardingTour.refresh();
}
// Mark only app-owned history entries so Back never leaves a direct-open page.
let routeDepth = Number(history.state && history.state.pengoDepth) || 0;
history.replaceState(Object.assign({}, history.state, { pengoDepth: routeDepth }), '', location.href);
window.addEventListener("hashchange", function () {
  if (history.state && Number.isInteger(history.state.pengoDepth)) routeDepth = history.state.pengoDepth;
  else {
    routeDepth++;
    history.replaceState(Object.assign({}, history.state, { pengoDepth: routeDepth }), '', location.href);
  }
  render();
});
function bindPageBack(view, name) {
  const detail = ['k', 'v', 'g'].includes(name) || (name === 'kanji' && !!$('.detail-head', view));
  const browse = ['kanji', 'vocab', 'grammar', 'flashcards', 'search'].includes(name) && !detail && !$('.recall-deck', view);
  $$('a[href]', view).filter(a =>
    (detail && a === $('p a', view)) || /^← (Home|Back)/.test(a.textContent.trim()) || a.classList.contains('pg-back')
  ).forEach(a => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn soft page-back' + (a.classList.contains('pg-back') ? ' pg-back' : '');
    button.dataset.backFallback = a.getAttribute('href');
    button.textContent = '← Back'; button.setAttribute('aria-label', 'Go back');
    a.replaceWith(button);
  });
  if (browse && !$('.page-back', view)) {
    view.insertAdjacentHTML('afterbegin', '<button type="button" class="btn soft page-back" data-back-fallback="' + (name === 'search' ? '#/' : '#/learn') + '">← Back</button>');
  }
  $$('.page-back', view).forEach(button => button.addEventListener('click', function () {
    if (routeDepth > 0) history.back(); else go(button.dataset.backFallback || '#/');
  }));
}
function applyDetailScope(view, type, id) {
  if (inStudyLevel(type, id)) return true;
  const actions = $('.action-row', view); if (actions) actions.remove();
  const note = $('.note', view); if (note) note.closest('.card').remove();
  $('.detail-head', view).insertAdjacentHTML('afterend', '<p class="study-focus browse-only" role="note"><strong>Just exploring</strong>Outside your ' + esc(store.course.target) + ' plan. This item won’t enter your learning cards or quizzes.</p>');
  return false;
}

/* The chosen level scopes learning; discovery can open any available item. */
function studyLevels() { return store.course && LEVELS.includes(store.course.target) ? [store.course.target] : LEVELS; }
function studyLevel(requested) {
  return store.course && LEVELS.includes(store.course.target) ? store.course.target :
    LEVELS.includes(String(requested || "").toUpperCase()) ? String(requested).toUpperCase() : "N5";
}
function inStudyLevel(type, id) {
  if (!store.course || !LEVELS.includes(store.course.target)) return true;
  var lv = store.course.target;
  var rows = type === "kanji" ? DB.levels[lv] : type === "vocab" ? DB.vocab[lv] : DB.grammar[lv];
  return (rows || []).some(function (r) { return (type === "kanji" ? r.k : r.id) === id; });
}
function studyFocusHTML() {
  return store.course ? '<p class="study-focus"><strong>Your ' + esc(store.course.target) + ' adventure</strong><a href="#/settings?section=plan">Change plan</a></p>' : '';
}

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
function progressBar(pct, label) {
  return "<div class=\"progress-track\" role=\"progressbar\" aria-label=\"" + esc(label || "Learning progress") + "\" aria-valuenow=\"" + pct + "\" aria-valuemin=\"0\" aria-valuemax=\"100\">" +
    "<div class=\"progress-fill\" style=\"width:" + pct + "%\"></div></div>";
}
function toggleLearned(ch) {
  if (!inStudyLevel("kanji", ch)) return;
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
  if (!inStudyLevel("kanji", ch)) return;
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
function renderHomeSplash(view) { renderAdventureHome(view, false); }
function renderHomeDash(view) { renderAdventureHome(view, true); }
function renderTodayItems(view, q) {
  var day = store.study.days[Course.todayStr()] || {};
  var items = Object.keys(day.practiced || {}).map(function (key) {
    var colon = key.indexOf(':');
    return { type: key.slice(0, colon), id: key.slice(colon + 1) };
  }).filter(function (item) { return Practice.TYPES.includes(item.type) && practiceRecord(item.type, item.id); });
  var kind = Practice.TYPES.includes(q.kind) ? q.kind : 'all';
  var groups = Practice.TYPES.filter(function (type) { return kind === 'all' || kind === type; });
  view.innerHTML = '<p><a href="#/">← Home</a></p><h1>Today’s learned items</h1>' +
    '<p class="explain">Items you studied or practiced today.</p><div class="chip-row" role="group" aria-label="Today’s subjects">' +
    [['all', 'All'], ['kanji', 'Kanji'], ['vocab', 'Vocabulary'], ['grammar', 'Grammar']].map(function (entry) {
      return '<button class="chip" data-today-kind="' + entry[0] + '" aria-pressed="' + (kind === entry[0]) + '">' + entry[1] + '</button>';
    }).join('') + '</div>' + groups.map(function (type) {
      var studied = items.filter(function (item) { return item.type === type; });
      return '<section class="card today-items" data-today-subject="' + type + '"><h2>' + courseTypeName(type) + ' <span class="badge">' + studied.length + '</span></h2>' +
        (studied.length ? studied.map(function (item) { return courseItemRow(type, item.id, false); }).join('') :
          '<p class="explain">No ' + (type === 'vocab' ? 'vocabulary' : type) + ' items studied yet today.</p>') + '</section>';
    }).join('');
  $$('[data-today-kind]', view).forEach(function (button) {
    button.addEventListener('click', function () { go('#/today?kind=' + button.dataset.todayKind); });
  });
}
/* ---------- Learn (one tab for Kanji, Vocabulary, Grammar) ---------- */
function renderLearn(view, q) {
  if (q.start === '1' || q.resume === '1') { renderPractice(view, q); return; }
  const lv = studyLevel(q.lv);
  const subjects = [['kanji', 'Kanji', '漢', 'kanji', levelStats(lv)],
    ['vocab', 'Vocabulary', '語', 'words', vLevelStats(lv)],
    ['grammar', 'Grammar', '文', 'points', gLevelStats(lv)]];
  view.innerHTML = '<h1>Learn</h1>' + (store.course ? studyFocusHTML() : '') +
    (store.course ? '' : '<div class="chip-row" role="group" aria-label="Learn level">' + studyLevels().map(l =>
      '<button class="chip" data-lv="' + l + '" aria-pressed="' + (l === lv) + '">' + l + '</button>').join('') + '</div>') +
    flashcardEntryHTML(lv) + '<div class="level-grid learn-subjects" aria-label="Study subjects">' + subjects.map((subject, i) => {
      const stats = subject[4];
      return '<a class="level-card" href="#/' + subject[0] + '/' + lv + '"><div class="lvl"><span class="dash-tile-ico t' + (i + 1) + '" aria-hidden="true">' + subject[2] +
        '</span><span class="level-title">' + subject[1] + '</span></div><div class="count">' + stats.learned + ' / ' + stats.total +
        '<span class="sr-only"> learned</span></div>' + progressBar(stats.pct, subject[1] + ' progress') + '</a>';
    }).join('') + '</div><section id="learnQuizzes" class="learn-quizzes" aria-labelledby="learnQuizTitle"></section>';
  renderPractice($('#learnQuizzes', view), q, view);
  $$('[data-lv]', view).forEach(c => c.addEventListener('click', () => go('#/learn?lv=' + c.dataset.lv)));
}

/* Detail pages keep a validated route back to the exact saved learning deck. */
function learningCardReturn(query) {
  if (!query.deck) return null;
  const deck = [practiceSession(), practiceSession('pausedSession')].find(s =>
    s && s.id === query.deck && s.config.format === 'recall');
  return deck ? '#/flashcards?resume=1&deck=' + encodeURIComponent(deck.id) : null;
}
function bindLearningCardReturn(view, query, name) {
  if (!['k', 'v', 'g', 'kanji'].includes(name)) return;
  const back = learningCardReturn(query);
  if (!back) return;
  const button = $('.page-back', view);
  if (button) button.dataset.backFallback = back;
  $$('a[href]', view).forEach(a => {
    if (/^#\/(k|v|g)\//.test(a.getAttribute('href'))) {
      const parts = a.getAttribute('href').split('?');
      const params = new URLSearchParams(parts[1] || ''); params.set('deck', query.deck);
      a.href = parts[0] + '?' + params.toString();
    }
  });
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
  const lv = studyLevel(level);
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
  const chips = studyLevels().map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(r => kanjiCard(r.item, r.level)).join("") :
    "<p class=\"empty\">No kanji match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Browse kanji</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"bq\" placeholder=\"Search " + lv + " kanji\" value=\"" + esc(query) + "\" aria-label=\"Search\">" +
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
      else if (kind === "vocab") count.innerHTML = items.length + " words · <a href=\"#/learn?section=quiz&tab=quiz&kind=vocab&lv=" + level + "\">Quiz " + level + "</a>";
      else count.innerHTML = items.length + " points · <a href=\"#/learn?section=quiz&tab=quiz&kind=grammar&lv=" + level + "\">Quiz " + level + "</a>";
      const hash = link({ q: text });
      if (location.hash !== hash) history.replaceState(history.state, "", hash);
    }, 150);
  });
}

/* ---------- Detail ---------- */
function compRow(c) {
  const inner = "<span class=\"cchar jp\" lang=\"ja\">" + esc(c.c) + "</span>" +
    "<span class=\"cinfo\"><span class=\"cm\">" + (esc(c.m) || "—") + "</span></span>";
  if (c.link && DB.byChar[c.link])
    return "<a class=\"comp\" href=\"#/k/" + encodeURIComponent(c.link) + "\">" + inner + "</a>";
  return "<div class=\"comp\">" + inner + "</div>";
}
function renderDetail(view, ch) {
  const rec = store.course && LEVELS.includes(store.course.target) && inStudyLevel("kanji", ch) ? { item: (DB.levels[store.course.target] || []).find(r => r.k === ch), level: store.course.target } : DB.byChar[ch];
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
    "</div>" +
    "<div class=\"action-row\">" +
    "<button class=\"btn " + (learned ? "good" : "primary") + "\" id=\"dLearn\" aria-pressed=\"" + learned + "\">" + (learned ? "✓ Learned" : "Mark as learned") + "</button>" +
    "<button class=\"btn\" id=\"dFav\" aria-pressed=\"" + fav + "\">" + (fav ? "★ Favorited" : "☆ Favorite") + "</button>" +
    "<a class=\"btn soft\" href=\"#/learn?section=quiz&tab=quiz&lv=" + lv + "\">Quiz " + lv + "</a>" +
    "</div></div></div>" +
    "<div class=\"card\" id=\"strokeCard\"><h2>Stroke order" + (it.strokes ? " (" + it.strokes + ")" : "") + "</h2>" +
    "<div class=\"stroke-comp\"><div class=\"stroke-col\"><div class=\"stroke-wrap\"><div class=\"stroke-svg\" id=\"strokeBox\" aria-label=\"Stroke order diagram\"><p class=\"explain\">Loading...</p></div>" +
    "<div class=\"stroke-ctrl\"><button class=\"btn\" id=\"strokePlay\">▶ Play stroke order</button>" +
    "<label class=\"explain\"><input type=\"checkbox\" id=\"strokeNums\" checked> show stroke numbers</label></div></div></div>" +
    "<div class=\"comp-col\"><h3>Components</h3>" +
    componentsHTML(it) + "</div></div></div>" +
    WritingUI.html() +
    "<div class=\"card mnemonic-card\"><h2>Mnemonic</h2>" + storyComponentsHTML(it) + "<p class=\"mnemonic\">" + esc(mn.text) + "</p>" +
    "<p class=\"explain\">" + esc(mn.notice) + "</p></div>" +
    "<div class=\"card\"><h2>Vocabulary</h2><ul class=\"vocab-list\">" + vocab + "</ul>" + vocabLinksForKanji(ch) + "</div>" +
    "<div class=\"card\"><h2>Example sentences</h2><ul class=\"sent-list\">" + sents + "</ul></div>" +
    "<div class=\"card\"><h2>Similar kanji</h2><p class=\"jp\" lang=\"ja\">" + conf + "</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"dNote\" aria-label=\"Personal note\">" + esc(store.notes[ch] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(prev.k) + "\">← " + esc(prev.k) + "</a>" +
    "<a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(next.k) + "\">" + esc(next.k) + " →</a></div>";
  if (!applyDetailScope(view, "kanji", ch)) { initStrokeOrder(it); return; }
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
const strokeChunkLoads = {};
function loadStrokeFallback(cp) {
  if (!/^[0-9a-f]{5,6}$/.test(cp)) return Promise.reject(new Error("invalid code point"));
  if (window.KK_STROKES && window.KK_STROKES[cp]) return Promise.resolve(window.KK_STROKES[cp]);
  const chunk = cp.slice(0, -2);
  if (!strokeChunkLoads[chunk]) {
    strokeChunkLoads[chunk] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "data/strokes/" + chunk + ".js";
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error("stroke bundle unavailable")); };
      document.head.appendChild(script);
    }).catch(e => { delete strokeChunkLoads[chunk]; throw e; });
  }
  return strokeChunkLoads[chunk].then(() => (window.KK_STROKES || {})[cp] || "");
}
async function initStrokeOrder(it) {
  const box = $("#strokeBox");
  if (!box) return;
  const writingHost = $("#writingCard");
  function unavailable(message) {
    box.innerHTML = '<p class="explain">' + message + '</p>';
    WritingUI.unavailable(writingHost, 'Writing practice needs a stroke-order diagram. ' + message);
  }
  const playButton = $("#strokePlay"), numbersToggle = $("#strokeNums");
  if (playButton) playButton.disabled = true;
  if (numbersToggle) numbersToggle.disabled = true;
  if (!it.hasStroke) {
    unavailable('No stroke-order diagram in the data for this kanji.');
    return;
  }
  const svgUrl = STROKE_BASE + it.cp + ".svg";
  let svgText = "";
  let diag = "";
  // Browsers commonly reject fetch and XHR for file URLs; classic scripts work.
  if (location.protocol !== "file:") {
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
          x.onload = () => {
            diag += "xhr:s" + x.status + ";";
            if ((x.status >= 200 && x.status < 300) || x.status === 0) resolve(x.responseText || "");
            else reject(new Error("http" + x.status));
          };
          x.onerror = () => { diag += "xhrErr;"; reject(new Error("xhr")); };
          x.send();
        });
      } catch (e2) { svgText = ""; }
    }
  }
  if (!svgText || svgText.indexOf("<svg") < 0) {
    try { svgText = await loadStrokeFallback(it.cp); diag += "script;"; }
    catch (e) { diag += "scriptErr;"; }
  }
  // A learner may leave the detail page while the diagram is loading.
  if (!box.isConnected || $("#strokeBox") !== box) return;
  window.KKDiag = window.KKDiag || {};
  window.KKDiag.stroke = diag + "len" + svgText.length;
  if (!svgText || svgText.indexOf("<svg") < 0) {
    unavailable('Could not load the stroke-order diagram. Try reopening this kanji.');
    return;
  }
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) { unavailable('Could not parse the diagram.'); return; }
  svg.removeAttribute("width"); svg.removeAttribute("height");
  const strokes = Array.from(svg.querySelectorAll("path")).filter(p => (p.getAttribute("id") || "").indexOf("-s") >= 0);
  if (!strokes.length) { unavailable('No stroke paths in this diagram.'); return; }
  strokes.forEach(p => p.classList.add("kvg-stroke"));
  const nums = Array.from(svg.querySelectorAll("text"));
  box.innerHTML = "";
  box.appendChild(svg);
  WritingUI.ready(writingHost, svg, strokes, it.k);
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
  playButton.disabled = false;
  numbersToggle.disabled = false;
  playButton.addEventListener("click", play);
  numbersToggle.addEventListener("change", e => {
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
function srsGrade(id, ok) {
  store.srs[id] = Practice.nextReview(store.srs[id], ok, Date.now(), Course.todayStr());
  if (ok && !store.learned[id]) { store.learned[id] = Date.now(); recordStudyItem("kanji", id); }
  save();
}

function dueCards() {
  const now = Date.now();
  return Object.keys(store.srs).filter(k => store.srs[k].due <= now && DB.byChar[k] && inStudyLevel("kanji", k));
}
/* ---------- Quiz result celebration (Pengo stickers) ---------- */

function quizClip(text, limit) {
  text = String(text || "").trim();
  return text.length > limit ? text.slice(0, limit).trim() + "…" : text;
}
function quizReviewHTML(kind, item) {
  if (kind === "kanji") {
    const readings = [];
    if (item.on && item.on.length) readings.push('<span><strong lang="ja">音読み:</strong> <span lang="ja">' + esc(item.on.join('、 ')) + '</span></span>');
    if (item.kun && item.kun.length) readings.push('<span><strong lang="ja">訓読み:</strong> <span lang="ja">' + esc(item.kun.join('、 ')) + '</span></span>');
    const parts = learningComponents(item).slice(0, 4).map(c => {
      const body = '<span lang="ja">' + esc(c.c) + '</span>' + (c.m ? '<small>' + esc(quizClip(c.m, 28)) + '</small>' : '');
      return c.c !== item.k && DB.byChar[c.c] ?
        '<a class="recap-shape" href="#/k/' + encodeURIComponent(c.c) + '">' + body + '</a>' : '<span class="recap-shape">' + body + '</span>';
    }).join('');
    const words = (item.vocab || []).slice(0, 2).map(v => '<li><span lang="ja">' + esc(v.w) + ' (' + esc(v.r) + ')</span> — ' + esc(v.m) + '</li>').join('');
    const mnemonic = mnemonicFor(item).text;
    const sentences = (item.sentences || []).filter(s => s.jp && s.en && /[A-Za-z]/.test(s.en) && !/\(#\d|#\d/.test(s.en));
    const example = sentences.find(s => /<ruby[\s>]/.test(s.furi || '')) || sentences[0];
    return '<section class="card quiz-review"><h3>Quick recap <span lang="ja">' + esc(item.k) + '</span></h3>' +
      '<p><strong>Meaning:</strong> ' + esc(item.meaning) + '</p>' +
      (readings.length ? '<p class="quiz-review-readings">' + readings.join(' ') + '</p>' : '') +
      (parts ? '<div class="recap-parts"><strong>Shapes</strong><div class="recap-shapes" aria-label="Larger kanji shapes">' + parts + '</div></div>' : '') +
      (mnemonic ? '<p class="recap-mnemonic"><strong>Memory aid:</strong> ' + esc(mnemonic) + '</p>' : '') +
      (words ? '<p><strong>Example words</strong></p><ul class="quiz-review-list">' + words + '</ul>' : '') +
      (example ? '<p class="quiz-review-example jp" lang="ja">' + (example.furi || esc(example.jp)) + '</p><p class="explain quiz-review-translation">' + esc(example.en) + '</p>' : '') + '</section>';
  }
  if (kind === "vocab") {
    const ex = (item.sentences || [])[0];
    return "<section class=\"card quiz-review\"><h3>Quick recap <span lang=\"ja\">" + esc(item.word) + "</span></h3>" + "<p><strong>Reading:</strong> <span lang=\"ja\">" + esc(item.reading) + "</span> &nbsp; <strong>Meaning:</strong> " + esc(item.meaning) + "</p>" +
      (item.meanings && item.meanings.length > 1 ? "<p><strong>Also:</strong> " + esc(item.meanings.slice(1, 4).join("; ")) + "</p>" : "") +
      (ex ? "<p class=\"quiz-review-example jp\" lang=\"ja\">" + (ex.furi || esc(ex.jp)) + "</p>" + (ex.en ? "<p class=\"explain quiz-review-translation\">" + esc(ex.en) + "</p>" : "") : "") + "</section>";
  }
  const formation = (item.sections || []).find(s => String(s.label || "").toLowerCase() === "formation");
  const example = (item.examples || [])[0];
  return "<section class=\"card quiz-review\"><h3>Quick recap <span lang=\"ja\">" + esc(item.point) + "</span></h3>" +
    "<p><strong>Meaning:</strong> " + esc(item.meaning) + "</p>" +
    (formation ? "<p><strong>Formation:</strong> " + esc(quizClip(stripTags(formation.html), 220)) + "</p>" : "") +
    (example ? "<p class=\"quiz-review-example jp\" lang=\"ja\">" + (example.furi || esc(example.jp)) + "</p>" + (example.en ? "<p class=\"explain quiz-review-translation\">" + esc(example.en) + "</p>" : "") : "") +
    "</section>";
}
function showQuizAnswer(body, correct, kind, item, nextButton) {
  $("#qFb").textContent = correct ? "Correct!" : "Not quite.";
  $("#qFb").closest(".card").insertAdjacentHTML("afterend", quizReviewHTML(kind, item));
  body.appendChild(nextButton);
}

function renderQuiz(body, q) { renderPractice(body, Object.assign({}, q, { kind: "kanji" })); }


function renderSearch(view, q) {
  const query = q.q || "";
  view.innerHTML =
    "<h1>Search</h1>" +
    "<div class=\"toolbar\"><input type=\"search\" id=\"sq\" placeholder=\"Search any word\" value=\"" + esc(query) + "\" aria-label=\"Search vocabulary by Japanese word or meaning\"></div>" +
    "<div id=\"sRes\"></div>";
  const box = $("#sRes"), input = $("#sq");
  function run() {
    const v = input.value.trim();
    history.replaceState(history.state, "", "#/search?" + new URLSearchParams({q: v}).toString());
    if (!v) { box.innerHTML = "<p class=\"empty\">Find a word by its Japanese spelling, reading, or English meaning.</p>"; return; }
    const vout = [];
    for (const lid of LEVELS) {
      for (const vv of (DB.vocab[lid] || [])) {
        if (matchVQuery(vv, v)) vout.push(vv);
        if (vout.length >= 120) break;
      }
      if (vout.length >= 120) break;
    }
    box.innerHTML = "<p class=\"result-count\">" + vout.length + (vout.length >= 120 ? "+" : "") + (vout.length === 1 ? " word" : " words") + "</p>" +
      (vout.length ? "<div class=\"kanji-grid\">" + vout.map(vocabCard).join("") + "</div>" : "<p class=\"empty\">No words match. Try another spelling, reading, or meaning.</p>");
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
    "<div class=\"study-summary\"><div><span class=\"study-summary-icon books\" aria-hidden=\"true\">" + pengoIcon("book") + "</span><span><strong>" + pengoNum(totalLearned) + "</strong><small>Items learned</small></span></div>" +
    "<div><span class=\"study-summary-icon time\" aria-hidden=\"true\">" + pengoIcon("clock") + "</span><span><strong>" + studyDuration(totalSeconds) + "</strong><small>Study time</small></span></div>" +
    "<div><span class=\"study-summary-icon calendar\" aria-hidden=\"true\">" + pengoIcon("calendar") + "</span><span><strong>" + studied + " / " + count + "</strong><small>Days studied</small></span></div></div></section>";
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
  var heroLevel = store.course ? studyLevel(q.level) : q.level || "";
  if (LEVELS.indexOf(heroLevel) < 0) {
    heroLevel = "N5";
    for (i = 0; i < LEVELS.length; i++) {
      var cand = combinedLevelStats(LEVELS[i]);
      if (cand.total > 0 && cand.pct < 100) { heroLevel = LEVELS[i]; break; }
    }
  }
  var hero = combinedLevelStats(heroLevel);
  var period = q.period === "month" ? "month" : "week";
  var chips = studyLevels().map(function (lv) {
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
  html.push(practiceDashboardHTML());
  html.push(studyStatsHTML(period));
  if (store.course) html.push('<section class="card course-treasures"><h2>' + pengoIcon('trophy') + 'Learning milestones</h2>' + courseMilestoneHTML() + '</section>');
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
    '<div class="settings-page"><h1>Settings</h1>' +
    courseSettingsCard() + '<div class="settings-grid"><div class="settings-column">' +
    '<section class="card"><div class="settings-card-title"><span class="settings-icon lavender">' + pengoIcon('spark') + '</span><div><h2>Make it comfy</h2><p>Little touches for your study space.</p></div></div>' +
    '<div class="settings-preference"><div><strong>Appearance</strong><small>A bright day or a cozy evening.</small></div><button class="btn soft" id="sTheme">Theme: ' + esc(s.theme) + '</button></div>' +
    '<label class="settings-preference" for="sAuto"><span><strong>Stroke order</strong><small>Auto-play when you open a kanji.</small></span><input class="settings-toggle" type="checkbox" id="sAuto"' + (s.autoplay ? ' checked' : '') + '></label></section>' +
    practiceSettingsHTML() + reminderSettingsHTML() + '</div><div class="settings-column">' +
    '<section class="card"><div class="settings-card-title"><span class="settings-icon mint">' + pengoIcon('book') + '</span><div><h2>Keep your discoveries</h2><p>Your progress deserves a safe place.</p></div></div><p class="explain">Save a backup to take your learning with you. Importing a backup replaces your current progress.</p><div class="settings-row">' +
    '<button class="btn soft" id="sExport">Export my data</button><button class="btn soft" id="sImportButton" type="button">Import backup</button><input type="file" id="sImport" accept="application/json" hidden></div><p class="explain">' + storeNote() + '</p></section>' +
    '<section class="card settings-reset"><div class="settings-card-title"><span class="settings-icon coral">' + pengoIcon('refresh') + '</span><div><h2>A clean slate</h2><p>Only when you want a fresh start.</p></div></div><p class="explain">This removes your progress, notes, plan and settings. Save a backup first if you’d like to keep them.</p><button class="btn soft danger" id="sWipe">Erase everything</button></section>' +
    "<details class=\"card settings-about\" id=\"credits\"><summary>Credits &amp; data sources</summary>" +
    '<p><a href="https://kanjivg.tagaini.net/">KanjiVG</a> · © Ulrich Apel · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>.</p>' +
    '<p class="explain">KanjiVG supplies stroke-order diagrams and component shapes. Component data is adapted from its SVG hierarchy with grouped parts and partial-breakdown labels; it retains the same license.</p>' +
    "<p class=\"explain\">Kanji facts: KANJIDIC2 + curated JLPT files. Components: KanjiVG hierarchy; EDRDG KRADFILE fallback. " +
    "Stroke art: KanjiVG (" + (DB.meta ? LEVELS.map(l => DB.meta.levels[l].stroke + "/" + DB.meta.levels[l].count + " " + l).join(" · ") : "") + "). " +
    "Dictionary facts: EDRDG, CC BY-SA 4.0. JLPT lists: Jonathan Waller. Sentences: Tatoeba contributors, CC BY 2.0 FR. Accents: Uros O. / Kanjium, CC BY-SA 4.0. Radical names: Kanji alive, CC BY 4.0. " +
    "Grammar: <a href=\"https://github.com/jkindrix/japanese-language-data\">Japanese Language Data</a> by Justin Kindrix and contributors, CC BY-SA 4.0 (" + (DB.grammarMeta ? DB.grammarMeta.total : gAll().length) + " adapted points). These community grammar notes are drafts and may contain errors. " +
    "<a href=\"resources/CREDITS.md\">Full credits and licenses</a>. <a href=\"LICENSE\">Application license: Apache-2.0</a>.</p></details>" +
    "<div class=\"card\"><h2>About this app</h2>" +
    "<p><button class=\"btn soft\" id=\"sIntro\">Replay intro</button></p>" + 
    "<p class=\"explain\">Pengo " + (window.APP_VERSION || "1.0.2") + " runs fully offline: all kanji, vocabulary and grammar data (incl. example sentences) plus stroke diagrams are bundled, with no account or network needed. Sources: KANJIDIC2, KRADFILE (EDRDG), KanjiVG, Tanaka Corpus, Kanjium. See resources/CREDITS.md for full attribution.</p></div></div></div></div>";
  bindReminderSettings(view);
  $("#sTheme").addEventListener("click", e => {
    s.theme = s.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
    e.target.textContent = "Theme: " + s.theme;
  });
  $("#practiceGoal").addEventListener("change", e => { s.dailyGoal = Practice.goal(e.target.value); Reminders.syncGoal(); save(); });
  $("#sAuto").addEventListener("change", e => { s.autoplay = e.target.checked; save(); });
  $("#sExport").addEventListener("click", () => {
    exportBackup();
  });
  $("#sImportButton").addEventListener("click", () => {
    if (window.PengoNative && typeof window.PengoNative.importJson === "function") window.PengoNative.importJson();
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
      Reminders.resetDevice();
      store = defaultStore(); save(); applyTheme();
      Reminders.syncGoal();
      try { localStorage.removeItem(LEGACY_STORE_KEY); } catch (e) {}
      try { localStorage.removeItem(ONBOARD_KEY); } catch (e) {}
      render();
    });
    $("#sWipeCancel").addEventListener("click", () => panel.remove());
  });
  const sIntro = $("#sIntro");
  if (sIntro) sIntro.addEventListener("click", () => showOnboarding(tour => {
    if (tour) OnboardingTour.start({ replay: true }); else render();
  }));
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
    if (store.vSrs[k].due <= now && DB.vById[k] && inStudyLevel("vocab", k)) n++;
  }
  return n;
}
function vDueCards() {
  const now = Date.now();
  return Object.keys(store.vSrs || {}).filter(k => store.vSrs[k].due <= now && DB.vById[k] && inStudyLevel("vocab", k));
}
function vSrsGrade(id, ok) {
  store.vSrs[id] = Practice.nextReview(store.vSrs[id], ok, Date.now(), Course.todayStr());
  if (ok && !store.vLearned[id]) { store.vLearned[id] = Date.now(); recordStudyItem("vocab", id); }
  save();
}

function toggleVLearned(id) {
  if (!inStudyLevel("vocab", id)) return;
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
  if (!inStudyLevel("vocab", id)) return;
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
    if (matchEnglishPhrase(v.meaning, f)) return true;
    if ((v.meanings || []).some(m => matchEnglishPhrase(m, f))) return true;
  }
  const rq = foldReading(t);
  if (rq) {
    if (foldReading(v.reading).indexOf(rq) >= 0) return true;
    if (foldReading(v.word).indexOf(rq) >= 0) return true;
  }
  return false;
}
function matchEnglishPhrase(meaning, query) {
  const phrase = foldEnglish(query).replace(/\s+/g, " ");
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^\\p{L}\\p{N}])" + escaped + "(?=$|[^\\p{L}\\p{N}])", "u")
    .test(foldEnglish(meaning).replace(/\s+/g, " "));
}
function vocabCard(v) {
  const fav = isVFav(v.id) ? "<span class=\"fav-star\" aria-label=\"Favorite\">*</span>" : "";
  return "<article class=\"kcard vcard\"><a class=\"vocab-card-link\" href=\"#/v/" + encodeURIComponent(v.id) + "\">" + fav +
    "<span class=\"vword jp\" lang=\"ja\">" + esc(v.word) + "</span>" +
    "<span class=\"read\" lang=\"ja\">" + esc(v.reading) + "</span>" +
    "<span class=\"mean\">" + esc(v.meaning) + "</span>" +
    "<span class=\"meta\"><span class=\"badge " + levelClass(v.jlpt) + "\">" + v.jlpt + "</span>" + vStatusDot(v.id) + "</span></a>" + "</article>";
}
function renderVocabHome(view) {
  if (store.course) { renderVocabBrowse(view, store.course.target, {}); return; }
  const due = vDueCount();
  const cards = studyLevels().map(lv => {
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
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/learn?section=quiz&mode=due&kind=vocab\">Practice now — " + due + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<div class=\"card\"><h2>How vocab review works</h2>" +
    "<p class=\"explain\">Browse a level, open a word to see its kanji links and example sentences, mark it learned, then lock it in with quizzes. Words you favorite or annotate sync into the same backup as your kanji progress.</p>" +
    "<p><a class=\"btn\" href=\"#/vocab/N5\">Browse N5 words</a> <a class=\"btn soft\" href=\"#/search?q=\">Search words</a></p></div>";
}
function renderVocabBrowse(view, level, q) {
  const lv = studyLevel(level);
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
  const chips = studyLevels().map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(vocabCard).join("") :
    "<p class=\"empty\">No words match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Vocabulary " + lv + "</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"vq\" placeholder=\"Search " + lv + " words\" value=\"" + esc(query) + "\" aria-label=\"Search vocabulary\">" +
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
    "<p class=\"result-count\" id=\"vocabResultCount\">" + recs.length + " words · <a href=\"#/learn?section=quiz&tab=quiz&kind=vocab&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
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
    "</div>" +
    "<div class=\"action-row\">" +
    "<button class=\"btn " + (learned ? "good\" aria-pressed=\"true" : "primary\" aria-pressed=\"false") + "\" id=\"vLearn\">" + (learned ? "Learned" : "Mark as learned") + "</button>" +
    "<button class=\"btn\" id=\"vFav\" aria-pressed=\"" + fav + "\">" + (fav ? "Favorited" : "Favorite") + "</button>" +
    "<a class=\"btn soft\" href=\"#/learn?section=quiz&tab=quiz&kind=vocab&lv=" + v.jlpt + "\">Quiz " + v.jlpt + "</a>" +
    "</div></div></div>" +
    "<div class=\"card\"><h2>Meanings</h2><p>" + meanings + "</p>" +
    "<h2>Kanji in this word</h2><p>" + klinks + "</p>" +
    "<p class=\"explain\">Tap a kanji to open its stroke order, components and mnemonic.</p></div>" +
    "<div class=\"card\"><h2>Example sentences</h2><ul class=\"sent-list\">" + sents + "</ul>" +
    "<p class=\"explain\">Sentences: Tatoeba JP-EN pairs matched by exact word occurrence at build time (CC BY 2.0 FR). Shortest matches kept; quality varies.</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"vNote\" aria-label=\"Personal note\">" + esc(store.vNotes[id] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/v/" + encodeURIComponent(prev.id) + "\">← " + esc(prev.word) + "</a>" +
    "<a class=\"btn soft\" href=\"#/v/" + encodeURIComponent(next.id) + "\">" + esc(next.word) + " →</a></div>";
  if (!applyDetailScope(view, "vocab", id)) return;
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
    "<p class=\"explain\"><a href=\"#/learn?section=quiz&kind=kanji\">Kanji quiz</a> · Vocabulary quiz &middot; <a href=\"#/learn?section=quiz&tab=quiz&kind=grammar\">Grammar quiz</a></p>" +
    "<div id=\"revBody\"></div>";
  renderVQuiz(document.querySelector("#revBody"), q);
}
function renderVQuiz(body, q) { renderPractice(body, Object.assign({}, q, { kind: "vocab" })); }

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
    if (store.gSrs[k].due <= now && DB.gById[k] && inStudyLevel("grammar", k)) n++;
  }
  return n;
}
function gDueCards() {
  const now = Date.now();
  return Object.keys(store.gSrs || {}).filter(k => store.gSrs[k].due <= now && DB.gById[k] && inStudyLevel("grammar", k));
}
function gSrsGrade(id, ok) {
  store.gSrs[id] = Practice.nextReview(store.gSrs[id], ok, Date.now(), Course.todayStr());
  if (ok && !store.gLearned[id]) { store.gLearned[id] = Date.now(); recordStudyItem("grammar", id); }
  save();
}

function toggleGLearned(id) {
  if (!inStudyLevel("grammar", id)) return;
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
  if (!inStudyLevel("grammar", id)) return;
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
  if (store.course) { renderGrammarBrowse(view, store.course.target, {}); return; }
  const due = gDueCount();
  const cards = studyLevels().map(lv => {
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
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/learn?section=quiz&mode=due&kind=grammar\">Practice now &mdash; " + due + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<div class=\"card\"><h2>How grammar review works</h2>" +
    "<p class=\"explain\">Browse a level, open a point to see its explanation, formation and examples (tap to reveal translations), mark it learned, then lock it in with quizzes. Points you favorite or annotate sync into the same backup as your kanji and vocabulary progress.</p>" +
    "<p><a class=\"btn\" href=\"#/grammar/N5\">Browse N5 grammar</a></p></div>";
}
function renderGrammarBrowse(view, level, q) {
  const lv = studyLevel(level);
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
  const chips = studyLevels().map(l =>
    "<button class=\"chip\" data-lv=\"" + l + "\" aria-pressed=\"" + (l === lv) + "\">" + l + "</button>").join("");
  const grid = recs.length ? recs.map(grammarCard).join("") :
    "<p class=\"empty\">No grammar points match. Try a different search or filter.</p>";
  view.innerHTML =
    "<h1>Grammar " + lv + "</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"JLPT level\">" + chips + "</div>" +
    "<div class=\"toolbar\">" +
    "<input type=\"search\" id=\"gq\" placeholder=\"Search " + lv + " grammar\" value=\"" + esc(query) + "\" aria-label=\"Search grammar\">" +
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
    "<p class=\"result-count\" id=\"grammarResultCount\">" + recs.length + " points &middot; <a href=\"#/learn?section=quiz&tab=quiz&kind=grammar&lv=" + lv + "\">Quiz " + lv + "</a></p>" +
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
    "<a class=\"btn soft\" href=\"#/learn?section=quiz&tab=quiz&kind=grammar&lv=" + g.jlpt + "\">Quiz " + g.jlpt + "</a>" +
    "</div></div></div>" +
    (secs ? "<div class=\"card\"><h2>Explanation</h2>" + secs + "</div>" : "") +
    "<div class=\"card\"><h2>Examples</h2><ul class=\"sent-list\">" + exHtml + "</ul>" +
    "<p class=\"explain\">Grammar and examples: Japanese Language Data, Justin Kindrix and contributors, CC BY-SA 4.0. Community draft notes; tap a translation to reveal it.</p></div>" +
    (rel ? "<div class=\"card\"><h2>Related grammar</h2><p>" + rel + "</p></div>" : "") +
    "<div class=\"card\"><h2>Kanji in these examples</h2><p>" + klinks + "</p>" +
    "<h2>Vocabulary in these examples</h2><p>" + vlinks + "</p>" +
    "<p class=\"explain\">Tap a kanji or word to open it.</p></div>" +
    "<div class=\"card\"><h2>My note</h2><textarea class=\"note\" id=\"gNote\" aria-label=\"Personal note\">" + esc(store.gNotes[id] || "") + "</textarea></div>" +
    "<div class=\"pager\"><a class=\"btn soft\" href=\"#/g/" + encodeURIComponent(prev.id) + "\">&larr; " + esc(prev.point) + "</a>" +
    "<a class=\"btn soft\" href=\"#/g/" + encodeURIComponent(next.id) + "\">" + esc(next.point) + " &rarr;</a></div>";
  if (!applyDetailScope(view, "grammar", id)) return;
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
    "<p class=\"explain\"><a href=\"#/learn?section=quiz&kind=kanji\">Kanji quiz</a> &middot; <a href=\"#/learn?section=quiz&tab=quiz&kind=vocab\">Vocabulary quiz</a> &middot; Grammar quiz</p>" +
    "<div id=\"revBody\"></div>";
  renderGQuiz(document.querySelector("#revBody"), q);
}
function blankForm(g) {
  const forms = g.blankForms || [String(g.point || "").replace(/^\u301c/, "")];
  for (const base of forms) {
    if (!base) continue;
    for (const e of (g.examples || [])) {
      const jp = e.jp || "";
      const i = jp.indexOf(base);
      if (i >= 0) return { ex: e, blanked: jp.slice(0, i) + "＿＿" + jp.slice(i + base.length) };
    }
  }
  return null;
}
function gQuizLabelT(o) { return ((o.examples || [])[0] || {}).en || o.meaning; }

function renderGQuiz(body, q) { renderPractice(body, Object.assign({}, q, { kind: "grammar" })); }

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
  recordPracticeAnswer(type, id, ok);
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
  var c = store.course;
  return '<section class="card settings-plan" id="studyPlanSettings"><div class="settings-card-title"><span class="settings-icon mint">' + pengoIcon('flag') + '</span><div><span class="eyebrow">YOUR NEXT ADVENTURE</span><h2>Study plan</h2></div></div>' +
    (c ? '<div class="settings-plan-stats"><span><strong>' + esc(c.target) + '</strong>Your JLPT level</span><span><strong>' + c.dailyNew + '</strong>New items per batch</span></div><p class="explain">One level, little discoveries. Your batch waits for you whenever life gets busy.</p>' :
      '<p class="explain">Pick your JLPT level and a comfortable number of new discoveries each day. Pengo will keep your learning focused.</p>') +
    '<div class="settings-row"><a class="btn primary" href="#/course/setup">' + (c ? 'Change my plan' : 'Let’s make a plan') + pengoIcon('arrow') + '</a>' +
    (c ? '<a class="settings-text-link" href="#/course/reset">End plan</a>' : '') + '</div></section>';
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
  var current = store.course;
  var sel = { target: LEVELS.includes(String(q.target || '').toUpperCase()) ? String(q.target).toUpperCase() : (current || {}).target || 'N5',
    daily: current ? current.dailyNew : 5, examDate: (current || {}).examDate || '' };
  var levels = [ ['N5', 'First steps', 'A friendly place to begin', 'spark'], ['N4', 'Keep exploring', 'Build on the basics', 'book'],
    ['N3', 'Find your stride', 'Connect more of your Japanese', 'flag'], ['N2', 'Go a little deeper', 'Grow your everyday confidence', 'mountain'], ['N1', 'New horizons', 'Explore advanced Japanese', 'trophy'] ];
  var paces = [[3, 'A tiny adventure', 'Keep it light'], [5, 'Small & steady', 'Pengo’s suggestion'], [10, 'A little more', 'Room to explore'], [20, 'Feeling curious', 'A bigger handful']];
  view.innerHTML = '<div class="plan-setup"><a class="settings-text-link" href="' + (current ? '#/settings?section=plan' : '#/') + '">← ' + (current ? 'Back to settings' : 'Back home') + '</a>' +
    '<header class="plan-welcome"><div><span class="eyebrow">A JOURNEY AT YOUR PACE</span><h1>' + (current ? 'A fresh pace for you' : 'Where shall we go?') + '</h1><p>Choose your next adventure with Pengo. Small steps count, and you can change your mind anytime.</p></div><img src="assets/pengo-adventure.png" width="140" height="140" alt="Pengo, your study buddy"></header>' +
    '<section class="card plan-section"><div class="plan-step-title"><span>1</span><div><h2>Pick your JLPT destination</h2><p class="explain">Your learning cards and quizzes will use this level. You can explore every level in Search.</p></div></div><div class="plan-levels" role="group" aria-label="Target level">' +
    levels.map(function (l) { return '<button type="button" class="plan-level" data-lv="' + l[0] + '" aria-pressed="' + (l[0] === sel.target) + '"><span class="plan-level-icon">' + pengoIcon(l[3]) + '</span><strong>' + l[0] + '</strong><b>' + l[1] + '</b><small>' + l[2] + '</small><span class="plan-selected" aria-hidden="true">' + pengoIcon('check') + '</span></button>'; }).join('') + '</div></section>' +
    '<section class="card plan-section"><div class="plan-step-title"><span>2</span><div><h2>How many new discoveries a day?</h2><p class="explain">Try 5 to start. A batch waits until you’re ready; missed days never pile up new work.</p></div></div><div class="plan-paces" role="group" aria-label="Daily learning pace">' +
    paces.map(function (p) { return '<button type="button" class="plan-pace" data-pace="' + p[0] + '" aria-pressed="' + (p[0] === sel.daily) + '"><strong>' + p[0] + '<small> items</small></strong><b>' + esc(p[1]) + '</b><span>' + esc(p[2]) + '</span></button>'; }).join('') + '</div>' +
    '<label class="plan-custom" for="paceCustom">Or choose your own <input type="number" id="paceCustom" min="1" max="100" step="1" value="' + sel.daily + '" required> items</label>' +
    '<details class="plan-exam"><summary>Have an exam date in mind? <span>Optional</span></summary><label for="planExam">Your exam date</label><input type="date" id="planExam" value="' + esc(sel.examDate) + '"><p class="explain">Only a planning note. Your pace is always your choice.</p></details></section>' +
    '<section class="plan-sendoff"><p id="planPreview" role="status" aria-live="polite"></p><p class="explain">No rush. Take breaks. Pengo will be here.</p><button class="btn primary" id="planStart">' + (current ? 'Save my adventure' : 'Let’s begin') + pengoIcon('arrow') + '</button></section></div>';
  function update() {
    $$('[data-lv]', view).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lv === sel.target); });
    $$('[data-pace]', view).forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.pace) === sel.daily); });
    $('#planPreview', view).textContent = sel.target + ' · ' + sel.daily + ' new discoveries per batch · your own pace';
  }
  $$('[data-lv]', view).forEach(function (b) { b.addEventListener('click', function () { sel.target = b.dataset.lv; update(); }); });
  $$('[data-pace]', view).forEach(function (b) { b.addEventListener('click', function () { sel.daily = Number(b.dataset.pace); $('#paceCustom', view).value = sel.daily; update(); }); });
  $('#paceCustom', view).addEventListener('input', function (e) { if (e.target.checkValidity()) { sel.daily = Number(e.target.value); update(); } });
  $('#planStart', view).addEventListener('click', function () {
    if (!$('#paceCustom', view).reportValidity() || !$('#planExam', view).reportValidity()) return;
    sel.daily = Number($('#paceCustom', view).value);
    sel.examDate = $('#planExam', view).value;
    var isNew = !current || current.target !== sel.target;
    var keep = current || Course.defaultCourse(sel.target);
    store.course = { target: sel.target, examId: sel.examDate, examLabel: sel.examDate, examDate: sel.examDate,
      startDate: isNew ? Course.todayStr() : keep.startDate, dailyNew: sel.daily, weights: keep.weights || Course.defaultCourse(sel.target).weights,
      unlockedDay: isNew ? 1 : (keep.unlockedDay || 1), studyDays: keep.studyDays || [],
      milestones: isNew ? [] : (keep.milestones || []), quizzes: keep.quizzes || 0, perfectQuiz: !!keep.perfectQuiz };
    // Preserve answered progress; an old session cannot lead into another level.
    if (store.practice.session && store.practice.session.questions.some(function (item) { return item.lv !== sel.target; })) store.practice.session = null;
    if (!current && [3, 5, 10, 20].includes(sel.daily)) store.settings.dailyGoal = sel.daily;
    save(); Reminders.syncGoal(); go('#/');
  });
  update();
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
      "<a class=\"btn soft\" href=\"#/learn?section=quiz&kind=kanji\">Check your progress</a></p></div>" +
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

function courseBuildQuestion(item, lv, forcedVariant) {
  var head = practiceRecord(item.type, item.id);
  if (!head) return null;
  var variant = forcedVariant === 0 ? 0 : Math.floor(Math.random() * (item.type === "grammar" ? 4 : 3));
  if (item.type === "vocab") variant %= 2;
  if (item.type === "grammar") {
    if (variant === 3 && !blankForm(head)) variant = 0;
    if (variant === 2 && !((head.examples || [])[0] || {}).en) variant = 0;
  }
  var q = { type: item.type, id: item.id, variant: variant, head: head };
  var pool = item.type === "kanji" ? DB.levels[lv] : item.type === "vocab" ? DB.vocab[lv] : DB.grammar[lv];
  var seen = {}; seen[courseQuizOptionLabel(q, head)] = true;
  var reading = item.type === "kanji" ? foldReading(head.on[0] || head.kun[0] || "") : "";
  var others = shuffle((pool || []).filter(function (r) {
    if ((item.type === "kanji" ? r.k : r.id) === item.id) return false;
    if (forcedVariant === 0 && item.type === 'vocab' && foldReading(r.reading) === foldReading(head.reading)) return false;
    // Homophones or identical meanings make reverse questions ambiguous.
    if (variant === 1 && foldEnglish(r.meaning) === foldEnglish(head.meaning)) return false;
    if (item.type === "kanji" && variant === 2 && (r.on || []).concat(r.kun || []).some(function (rd) { return foldReading(rd) === reading; })) return false;
    return true;
  })).filter(function (r) {
    var label = courseQuizOptionLabel(q, r);
    if (!label || seen[label]) return false;
    seen[label] = true; return true;
  }).slice(0, 3);
  if (!others.length) return null;
  q.opts = shuffle([head].concat(others));
  return q;
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
  if (q.variant === 2) return "Which translation matches?<span class=\"mid jp\" lang=\"ja\">" + esc(((q.head.examples || [])[0] || {}).jp || "") + "</span>";
  if (q.variant === 3) return "Fill in the blank:<span class=\"mid jp\" lang=\"ja\">" + esc((blankForm(q.head) || {}).blanked || "") + "</span>";
  return "Which grammar point means: " + esc(q.head.meaning) + "?";
}
function courseQuizOptionLabel(q, o) {
  if (q.type === "kanji") return q.variant === 0 ? o.meaning : o.k;
  if (q.type === "vocab") return q.variant === 0 ? o.meaning : (o.word + (o.reading && o.reading !== o.word ? " (" + o.reading + ")" : ""));
  return q.variant === 0 ? o.meaning : q.variant === 2 ? gQuizLabelT(o) : o.point;
}
function courseQuizHeadLabel(q) {
  if (q.type === "kanji") return q.head.k + " = " + q.head.meaning;
  if (q.type === "vocab") return q.head.word + " = " + q.head.meaning;
  return q.head.point + " = " + q.head.meaning;
}
function renderCourseQuiz(view) { renderPractice(view, { mode: "plan", lv: store.course.target }); }

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
  Reminders.init();

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
      if (!window.KKBack()) window.Capacitor.Plugins.App.exitApp();
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
  showOnboarding(tour => { bootData.then(() => {
    clearBootGate();
    if (tour) OnboardingTour.start({ replay: false });
    else { if (!store.course) go("#/course/setup"); render(); }
  }).catch(bootFailed); });
  bootData.catch(() => {});
} else {
  clearBootGate();
  bootData.then(() => { initChrome(); render(); }).catch(bootFailed);
}
