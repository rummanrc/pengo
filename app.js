"use strict";
/* KnowKanji - data-driven JLPT kanji study app (no build step).
   Data: data/n5..n1.json + data/radicals.json + data/meta.json (see scripts/build_data.py).
   Progress: localStorage key "knowkanji:v1". */

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const STORE_KEY = "knowkanji:v1";
const STROKE_BASE = "resources/stroke-order/kanjivg/";

const DB = { levels: {}, byChar: {}, meta: null, radicals: [], loaded: false };

const defaultStore = () => ({ learned: {}, fav: [], notes: {}, srs: {},
  settings: { theme: "light", dailyGoal: 10, autoplay: true }, quizBest: {} });

let store = defaultStore();
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) store = Object.assign(defaultStore(), JSON.parse(raw));
} catch (e) { /* fresh start */ }
if (!store.settings) store.settings = defaultStore().settings;
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
  }
  for (const lv of LEVELS)
    for (const it of DB.levels[lv]) DB.byChar[it.k] = { item: it, level: lv };
  DB.loaded = true;
}
async function loadDataFetch() {
  const [n5, n4, n3, n2, n1, meta, radicals] = await Promise.all([
    fetch("data/n5.json").then(r => r.json()),
    fetch("data/n4.json").then(r => r.json()),
    fetch("data/n3.json").then(r => r.json()),
    fetch("data/n2.json").then(r => r.json()),
    fetch("data/n1.json").then(r => r.json()),
    fetch("data/meta.json").then(r => r.json()),
    fetch("data/radicals.json").then(r => r.json()).catch(() => [])
  ]);
  DB.levels = { N5: n5, N4: n4, N3: n3, N2: n2, N1: n1 };
  DB.meta = meta; DB.radicals = radicals;
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
  return n;
}

/* ---------- Router ---------- */
const NAV = [
  { path: "#/", label: "Home", ico: "🏠", match: "home" },
  { path: "#/kanji", label: "Kanji", ico: "漢", match: "kanji" },
  { path: "#/study", label: "Study", ico: "📖", match: "study" },
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
  $("#bottomNav").innerHTML = NAV.slice(0, 5).map(n =>
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
  else if (name === "study") { renderNav("study"); renderStudy(view, seg[1], q); }
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
  view.innerHTML =
    "<h1>Learn kanji, one level at a time</h1>" +
    "<p class=\"lead\">Pick a JLPT level, browse kanji, break each one into components, remember it with a silly mnemonic, then lock it in with study and review. " + total + " kanji included.</p>" +
    (due > 0 ? "<p><a class=\"btn primary\" href=\"#/review\">🔁 Review now — " + due + " due</a></p>" : "") +
    "<div class=\"level-grid\">" + cards + "</div>" +
    "<div class=\"card\"><h2>How it works</h2>" +
    "<p class=\"explain\">JLPT → Kanji → Components → Funny mnemonic → Vocabulary → Study → Review. " +
    "Components marked with a Kangxi number (e.g. 木 #75) are true Kangxi radicals; the rest are " +
    "memory helpers from KRADFILE — the app always labels which is which. Mnemonics are original memory aids, not etymology.</p>" +
    "<p><a class=\"btn\" href=\"#/study\">Start studying</a> <a class=\"btn soft\" href=\"#/search\">Search kanji</a></p></div>";
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
    "<a class=\"btn soft\" href=\"#/study/" + lv + "\">Study " + lv + "</a>" +
    "</div></div></div>" +
    "<div class=\"card\" id=\"strokeCard\"><h2>Stroke order" + (it.strokes ? " (" + it.strokes + ")" : "") + "</h2>" +
    "<div class=\"stroke-wrap\"><div class=\"stroke-svg\" id=\"strokeBox\" aria-label=\"Stroke order diagram\"><p class=\"explain\">Loading...</p></div>" +
    "<div class=\"stroke-ctrl\"><button class=\"btn\" id=\"strokePlay\">▶ Play stroke order</button>" +
    "<label class=\"explain\"><input type=\"checkbox\" id=\"strokeNums\" checked> show stroke numbers</label></div></div></div>" +
    "<div class=\"card\"><h2>Components</h2>" +
    "<p class=\"explain\">Structural breakdown (KRADFILE). Badges tell Kangxi radicals apart from plain mnemonic parts.</p>" +
    "<div class=\"comp-list\">" + it.components.map(compRow).join("") + "</div></div>" +
    "<div class=\"card\"><h2>Mnemonic</h2><p class=\"mnemonic\">" + esc(mn.text) + "</p>" +
    "<p class=\"explain\">" + esc(mn.notice) + " Based on: " + (it.components.map(c => esc(c.c) + " (" + esc(c.m || "?") + ")").join(" + ") || "—") + ".</p></div>" +
    "<div class=\"card\"><h2>Vocabulary</h2><ul class=\"vocab-list\">" + vocab + "</ul></div>" +
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

/* ---------- Study (flashcards) ---------- */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function renderStudy(view, level, q) {
  const lv = LEVELS.includes((level || "").toUpperCase()) ? level.toUpperCase() : "N5";
  const mode = ["k2m", "m2k", "r2k"].includes(q.mode) ? q.mode : "k2m";
  const size = Math.min(50, Math.max(5, parseInt(q.n || store.settings.dailyGoal || 10, 10) || 10));
  const pool = shuffle(DB.levels[lv].slice());
  const deck = pool.slice(0, Math.min(size, pool.length));
  if (!deck.length) { view.innerHTML = "<p class=\"empty\">No cards.</p>"; return; }
  let i = 0, flipped = false;
  const modes = { k2m: "Kanji → meaning", m2k: "Meaning → kanji", r2k: "Reading → kanji" };
  function front(it) {
    if (mode === "m2k") return "<div class=\"mid\">" + esc(it.meaning) + "</div>";
    if (mode === "r2k") return "<div class=\"mid jp\" lang=\"ja\">" + esc(it.on[0] || it.kun[0] || "?") + "</div>";
    return "<div class=\"big\" lang=\"ja\">" + esc(it.k) + "</div>";
  }
  function back(it) {
    if (mode === "k2m") return "<div class=\"mid\">" + esc(it.meaning) + "</div><div class=\"sub\" lang=\"ja\">" + esc(it.on.concat(it.kun).slice(0, 4).join("·")) + "</div>";
    const m = mnemonicFor(it);
    return "<div class=\"big\" lang=\"ja\">" + esc(it.k) + "</div><div class=\"mid\">" + esc(it.meaning) + "</div>" +
      "<div class=\"sub\" lang=\"ja\">" + esc(it.on.concat(it.kun).slice(0, 4).join("·")) + "</div>" +
      "<p class=\"explain\">" + esc(m.text) + "</p>";
  }
  function draw() {
    const it = deck[i];
    view.innerHTML =
      "<h1>Study " + lv + "</h1>" +
      "<p class=\"explain\">" + modes[mode] + " · card " + (i + 1) + " of " + deck.length +
      " · <a href=\"#/study/" + lv + "?mode=k2m\">K→M</a> · <a href=\"#/study/" + lv + "?mode=m2k\">M→K</a> · <a href=\"#/study/" + lv + "?mode=r2k\">R→K</a></p>" +
      "<div class=\"flash\"><div class=\"flash-card\" id=\"fc\" role=\"button\" tabindex=\"0\" aria-label=\"Flashcard, activate to flip\">" +
      (flipped ? back(it) : front(it)) + "</div>" +
      "<div class=\"flash-nav\">" +
      "<button class=\"btn soft\" id=\"fPrev\">← Prev</button>" +
      "<button class=\"btn\" id=\"fFlip\">Flip</button>" +
      "<button class=\"btn soft\" id=\"fNext\">Next →</button>" +
      "<button class=\"btn\" id=\"fKnow\">" + (isLearned(it.k) ? "✓ Learned" : "Mark learned") + "</button>" +
      "<a class=\"btn soft\" href=\"#/k/" + encodeURIComponent(it.k) + "\">Open " + esc(it.k) + "</a>" +
      "</div></div>";
    const flip = () => { flipped = !flipped; draw(); };
    $("#fFlip").addEventListener("click", flip);
    $("#fc").addEventListener("click", flip);
    $("#fc").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    $("#fPrev").addEventListener("click", () => { i = (i - 1 + deck.length) % deck.length; flipped = false; draw(); });
    $("#fNext").addEventListener("click", () => { i = (i + 1) % deck.length; flipped = false; draw(); });
    $("#fKnow").addEventListener("click", e => {
      toggleLearned(it.k);
      e.target.textContent = isLearned(it.k) ? "✓ Learned" : "Mark learned";
    });
    document.onkeydown = (e) => {
      if (parseHash().seg[0] !== "study") { document.onkeydown = null; return; }
      if (e.key === "ArrowRight") { i = (i + 1) % deck.length; flipped = false; draw(); }
      else if (e.key === "ArrowLeft") { i = (i - 1 + deck.length) % deck.length; flipped = false; draw(); }
      else if (e.key === " ") { e.preventDefault(); flip(); }
    };
  }
  draw();
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
  const tab = q.tab === "quiz" ? "quiz" : "srs";
  view.innerHTML =
    "<h1>Review</h1>" +
    "<div class=\"chip-row\" role=\"group\" aria-label=\"Review mode\">" +
    "<button class=\"chip\" id=\"tabSrs\" aria-pressed=\"" + (tab === "srs") + "\">🔁 Spaced review</button>" +
    "<button class=\"chip\" id=\"tabQuiz\" aria-pressed=\"" + (tab === "quiz") + "\">❓ Quiz</button></div>" +
    "<div id=\"revBody\"></div>";
  $("#tabSrs").addEventListener("click", () => go("#/review?tab=srs"));
  $("#tabQuiz").addEventListener("click", () => go("#/review?tab=quiz"));
  if (tab === "quiz") renderQuiz($("#revBody"), q);
  else renderSrs($("#revBody"));
}
function renderSrs(body) {
  const due = shuffle(dueCards());
  const fresh = [];
  for (const lv of ["N5", "N4"]) {
    for (const it of DB.levels[lv]) {
      if (fresh.length >= store.settings.dailyGoal) break;
      if (!store.learned[it.k] && !store.srs[it.k]) fresh.push(it.k);
    }
  }
  const queue = due.concat(fresh.filter(k => due.indexOf(k) < 0)).slice(0, 30);
  if (!queue.length) {
    body.innerHTML = "<div class=\"card\"><h2>All caught up 🎉</h2>" +
      "<p class=\"explain\">Nothing is due. Mark more kanji as learned (or start them below) and they will appear here on schedule.</p>" +
      "<p><a class=\"btn\" href=\"#/study\">Study new cards</a> <a class=\"btn soft\" href=\"#/review?tab=quiz\">Take a quiz</a></p></div>";
    return;
  }
  let i = 0, show = false, right = 0;
  function draw() {
    const ch = queue[i], rec = DB.byChar[ch];
    if (!rec) { i++; if (i < queue.length) draw(); return; }
    const it = rec.item;
    body.innerHTML =
      "<p class=\"explain\">Card " + (i + 1) + " of " + queue.length + " · " + right + " correct</p>" +
      "<div class=\"flash\"><div class=\"flash-card\" id=\"rc\" role=\"button\" tabindex=\"0\" aria-label=\"Review card\">" +
      (show
        ? "<div class=\"big\" lang=\"ja\">" + esc(it.k) + "</div><div class=\"mid\">" + esc(it.meaning) + "</div><div class=\"sub\" lang=\"ja\">" + esc(it.on.concat(it.kun).slice(0, 4).join("·")) + "</div>"
        : "<div class=\"mid\">What is this?<br><br></div><div class=\"big\" lang=\"ja\">" + esc(it.k) + "</div>") +
      "</div><div class=\"flash-nav\">" +
      (show
        ? "<button class=\"btn\" id=\"rNo\">Forgot</button><button class=\"btn good\" id=\"rYes\">Remembered</button>"
        : "<button class=\"btn primary\" id=\"rShow\">Show answer</button>") +
      "</div></div>";
    if (!show) {
      const go2 = () => { show = true; draw(); };
      $("#rShow").addEventListener("click", go2);
      $("#rc").addEventListener("click", go2);
    } else {
      $("#rYes").addEventListener("click", () => { srsGrade(ch, true); right++; next(); });
      $("#rNo").addEventListener("click", () => { srsGrade(ch, false); queue.push(ch); next(); });
    }
  }
  function next() {
    i++; show = false;
    if (i >= queue.length) {
      body.innerHTML = "<div class=\"card\"><h2>Session done 🎉</h2><p>" + right + " remembered this round.</p>" +
        "<p><a class=\"btn\" href=\"#/progress\">See progress</a> <a class=\"btn soft\" href=\"#/review?tab=quiz\">Take a quiz</a></p></div>";
      renderNav("review");
    } else draw();
  }
  draw();
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
        "<p><button class=\"btn primary\" id=\"qRetry\">Retry</button> <a class=\"btn soft\" href=\"#/review?tab=srs\">Spaced review</a></p></div>";
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
    "<div class=\"toolbar\"><input type=\"search\" id=\"sq\" placeholder=\"Kanji, English meaning, or reading...\" value=\"" + esc(query) + "\" aria-label=\"Search all kanji\"></div>" +
    "<div id=\"sRes\"></div>";
  const box = $("#sRes"), input = $("#sq");
  function run() {
    const v = input.value.trim();
    if (!v) { box.innerHTML = "<p class=\"empty\">Try “tree”, “き”, “木”, “mori”... (English, kana, or the character itself).</p>"; return; }
    const out = [];
    for (const lv of LEVELS)
      for (const it of DB.levels[lv]) {
        if (matchQuery({ item: it }, v)) out.push({ item: it, level: lv });
        if (out.length >= 120) break;
      }
    box.innerHTML = "<p class=\"result-count\">" + out.length + (out.length >= 120 ? "+" : "") + " results</p>" +
      (out.length ? "<div class=\"kanji-grid\">" + out.map(r => kanjiCard(r.item, r.level)).join("") + "</div>" : "<p class=\"empty\">No matches.</p>");
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
  view.innerHTML =
    "<h1>Progress</h1>" +
    "<div class=\"card\"><h2>Overall</h2>" +
    "<p>" + learned + " / " + tot + " kanji learned · " + dueCount() + " due for review · " +
    store.fav.length + " favorites · " + Object.keys(store.notes).length + " notes</p>" +
    progressBar(tot ? Math.round(learned / tot * 100) : 0) + "</div>" +
    "<div class=\"card\"><h2>By level</h2><table class=\"stats\"><tr><th>Level</th><th>Total</th><th>Learned</th><th>Left</th><th></th><th>%</th></tr>" + rows + "</table></div>" +
    "<div class=\"card\"><h2>Quiz best scores</h2><p>" +
    LEVELS.map(lv => lv + ": " + (store.quizBest[lv] != null ? store.quizBest[lv] + " / 10" : "—")).join(" · ") + "</p></div>" +
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
    "<div class=\"card\"><h2>Study</h2><div class=\"settings-row\">" +
    "<label>Cards per session <input type=\"number\" id=\"sGoal\" min=\"5\" max=\"50\" value=\"" + (s.dailyGoal || 10) + "\" style=\"width:4.5rem\"></label>" +
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
    "Sentences: Tanaka Corpus + CSV set. Accents: Kanjium. Loader: " + (DB.source || "?") + ". Full credits in resources/CREDITS.md.</p></div>" +
    "<div class=\"card\"><h2>About this app</h2>" +
    "<p class=\"explain\">KnowKanji " + (window.APP_VERSION || "1.0.0") + " runs fully offline: all kanji data and stroke diagrams are bundled, with no account or network needed. Sources: KANJIDIC2, KRADFILE (EDRDG), KanjiVG, Tanaka Corpus, Kanjium. See resources/CREDITS.md for full attribution.</p></div>";
  $("#sTheme").addEventListener("click", e => {
    s.theme = s.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
    e.target.textContent = "Theme: " + s.theme;
  });
  $("#sGoal").addEventListener("change", e => {
    s.dailyGoal = Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 10));
    save();
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
