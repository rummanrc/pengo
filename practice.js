"use strict";
/* Pure practice/session rules. Content, DOM and persistence stay in app.js. */
var Practice = (function () {
  var TYPES = ["kanji", "vocab", "grammar"];
  var MODES = ["smart", "due", "mistakes", "plan", "explore"];
  var STEPS = [1, 3, 7, 16, 35, 80, 180];
  var BADGES = [
    { id: "first-practice", label: "First practice", hint: "Answer your first question" },
    { id: "first-goal", label: "Daily goal", hint: "Meet your daily practice goal" },
    { id: "steady-week", label: "Steady week", hint: "Practice on 5 of the last 7 days" },
    { id: "100-recalls", label: "100 attempts", hint: "Make 100 practice attempts" },
    { id: "comeback", label: "Welcome back", hint: "Return after a break of at least 2 days" }
  ];
  function key(item) { return item.type + ":" + item.id; }
  function size(n) { n = Number(n); return [3, 5, 10].indexOf(n) >= 0 ? n : 5; }
  function goal(n) { n = Number(n); return [3, 5, 10, 20].indexOf(n) >= 0 ? n : 5; }
  function config(q, fallback) {
    q = q || {};
    return { mode: MODES.indexOf(q.mode) >= 0 ? q.mode : "smart",
      kind: TYPES.indexOf(q.kind) >= 0 ? q.kind : "mixed",
      lv: ["N5", "N4", "N3", "N2", "N1"].indexOf(q.lv) >= 0 ? q.lv : fallback || "N5",
      size: size(q.size), format: ["recall"].indexOf(q.format) >= 0 ? q.format : "quiz" };
  }
  function select(pool, cfg, srsOf, mistakes, stateOf, rnd) {
    var seen = {}, candidates = (pool || []).filter(function (item) {
      if (seen[key(item)]) return false;
      seen[key(item)] = true;
      if (cfg.kind !== "mixed" && item.type !== cfg.kind) return false;
      var s = srsOf(item);
      if (cfg.mode === "due") return s.inSrs && s.isDue;
      if (cfg.mode === "mistakes") return !!(mistakes || {})[key(item)];
      return true;
    });
    if (cfg.mode === "due") {
      candidates.sort(function (a, b) { return (srsOf(a).due || 0) - (srsOf(b).due || 0); });
      return candidates.slice(0, size(cfg.size));
    }
    var selected = [], used = {}, want = size(cfg.size);
    function take(item) { if (!used[key(item)]) { used[key(item)] = true; selected.push(item); } }
    if (cfg.mode === "smart" || cfg.mode === "plan" || cfg.mode === "explore") {
      // Make a small mixed session cover each available skill, while favoring overdue work.
      if (cfg.kind === "mixed") TYPES.forEach(function (type) {
        var typed = candidates.filter(function (item) { return item.type === type; });
        var due = typed.filter(function (item) { return srsOf(item).inSrs && srsOf(item).isDue; });
        due.sort(function (a, b) { return (srsOf(a).due || 0) - (srsOf(b).due || 0); });
        var pick = due.length ? due[0] : Course.selectQuizItems(typed, stateOf, 1, rnd)[0];
        if (pick && selected.length < want) take(pick);
      });
      else {
        candidates.filter(function (item) { return srsOf(item).inSrs && srsOf(item).isDue; })
          .sort(function (a, b) { return (srsOf(a).due || 0) - (srsOf(b).due || 0); })
          .slice(0, Math.min(2, want)).forEach(take);
      }
    }
    if (selected.length >= want) return selected;
    Course.selectQuizItems(candidates.filter(function (item) { return !used[key(item)]; }), stateOf, want - selected.length, rnd).forEach(take);
    return selected;
  }
  function nextReview(previous, ok, now, day) {
    var s = Object.assign({ box: 0, due: 0 }, previous || {});
    s.box = Math.min(STEPS.length - 1, Math.max(0, Math.floor(Number(s.box) || 0)));
    if (!ok) { s.box = 0; s.due = now + 600000; }
    else if (s.lastCorrectDay !== day) {
      s.box = Math.min(STEPS.length - 1, s.box + 1);
      s.due = now + STEPS[s.box] * 86400000;
      s.lastCorrectDay = day;
    }
    s.lastReviewed = now;
    return s;
  }
  function count(day) {
    day = day || {};
    var keys = Object.keys(day.practiced || {});
    return keys.length + Math.max(0, Number(day.legacyLearned) || 0) || Math.max(0, Number(day.learned) || 0);
  }
  function normalize(value) {
    var p = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return { session: p.session || null, pausedSession: p.pausedSession || null,
      history: Array.isArray(p.history) ? p.history.filter(function (h) {
        return h && typeof h.date === "string" && Number.isFinite(h.total) && h.total > 0 && Number.isFinite(h.score);
      }).slice(-60) : [],
      badges: Array.isArray(p.badges) ? p.badges.filter(function (b) { return BADGES.some(function (x) { return x.id === b; }); }) : [],
      mistakes: p.mistakes && typeof p.mistakes === "object" && !Array.isArray(p.mistakes) ? p.mistakes : {} };
  }
  function validSession(s, exists) {
    if (!s || s.version !== 1 || typeof s.id !== "string" || !s.config ||
        MODES.indexOf(s.config.mode) < 0 || ["quiz", "recall"].indexOf(s.config.format) < 0 ||
        ["mixed", "kanji", "vocab", "grammar"].indexOf(s.config.kind) < 0 || size(s.config.size) !== s.config.size ||
        !["N5", "N4", "N3", "N2", "N1"].includes(s.config.lv) ||
        !Array.isArray(s.questions) || !s.questions.length || s.questions.length > 10 ||
        !Number.isInteger(s.cursor) || s.cursor < 0 || s.cursor > s.questions.length ||
        !Array.isArray(s.answers) || s.answers.length < s.cursor || s.answers.length > Math.min(s.cursor + 1, s.questions.length)) return false;
    var seen = {};
    return s.questions.every(function (q, i) {
      if (!q || TYPES.indexOf(q.type) < 0 || typeof q.id !== "string" ||
          !["N5", "N4", "N3", "N2", "N1"].includes(q.lv) || !Number.isInteger(q.variant) || q.variant < 0 || q.variant > 3 ||
          !exists(q) || seen[key(q)] || !Array.isArray(q.options) || q.options.length > 4) return false;
      seen[key(q)] = true;
      if (s.config.format !== "recall" && (q.options.length < 2 || q.options.indexOf(q.id) < 0 || new Set(q.options).size !== q.options.length)) return false;
      if (!q.options.every(function (id) { return typeof id === "string" && exists({ type: q.type, id: id }); })) return false;
      var a = s.answers[i];
      return i >= s.answers.length || (a && typeof a.ok === "boolean" && typeof a.selected === "string" &&
        (s.config.format === "recall" ? ["again", "remembered"].includes(a.selected) : q.options.includes(a.selected)));
    });
  }
  function stats(days, today, dailyGoal) {
    var week = [], active = 0, totalAttempts = 0, last = "";
    Object.keys(days || {}).forEach(function (date) {
      var d = days[date] || {};
      totalAttempts += Math.max(0, Number(d.attempts) || 0);
      if (date < today && count(d) > 0 && date > last) last = date;
    });
    for (var i = 6; i >= 0; i--) {
      var date = Course.addDays(today, -i), n = count((days || {})[date]);
      week.push({ date: date, count: n, active: n > 0 });
      if (n > 0) active++;
    }
    var done = count((days || {})[today]);
    return { week: week, active: active, done: done, goal: goal(dailyGoal), attempts: totalAttempts,
      goalMet: done >= goal(dailyGoal), breakDays: last ? Course.diffDays(last, today) - 1 : 0,
      streak: Course.calcStreak(Object.keys(days || {}).filter(function (d) { return count(days[d]) > 0; }), today) };
  }
  function earned(stats, have) {
    var eligible = { "first-practice": stats.attempts > 0, "first-goal": stats.goalMet,
      "steady-week": stats.active >= 5, "100-recalls": stats.attempts >= 100,
      "comeback": stats.breakDays >= 2 && stats.done > 0 };
    return BADGES.filter(function (b) { return eligible[b.id] && (have || []).indexOf(b.id) < 0; }).map(function (b) { return b.id; });
  }
  return { TYPES: TYPES, BADGES: BADGES, key: key, size: size, goal: goal, config: config, select: select,
    nextReview: nextReview, count: count, normalize: normalize, validSession: validSession, stats: stats, earned: earned };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Practice;
