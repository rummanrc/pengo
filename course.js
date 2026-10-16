"use strict";
/* Pengo course / daily learning system - pure logic, no DOM.
   The course layer references existing kanji/vocabulary/grammar records by
   stable ID ({ type: type, id: id }) instead of copying them:
     kanji      -> the kanji character itself (DB.byChar key)
     vocabulary -> vocab record id, e.g. "N5-1198180-0" (DB.vById key)
     grammar    -> grammar record id (DB.gById key)
   Persistence lives inside the existing store (localStorage "pengo:v1")
   as store.course, so export/import backup keeps working untouched.
   Written in ES5 style so it runs in the app WebView and under tests. */
var Course = (function () {
  var LEVELS = ["N5", "N4", "N3", "N2", "N1"];
  var DAY_MS = 86400000;
  var DEFAULT_WEIGHTS = { kanji: 3, vocab: 5, grammar: 2 };
  var DEFAULT_DAILY_NEW = 20;
  var MILESTONES = [
    { id: "first-session", label: "First study session" },
    { id: "streak-7", label: "7 day streak" },
    { id: "streak-30", label: "30 day streak" },
    { id: "vocab-100", label: "100 vocabulary learned" },
    { id: "kanji-50", label: "50 kanji learned" },
    { id: "quiz-perfect", label: "First 100% quiz" },
    { id: "course-25", label: "Completed 25% of course" },
    { id: "course-50", label: "Completed 50% of course" },
    { id: "course-done", label: "Completed course" }
  ];
  var QUIZ_WEIGHTS = { "new": 5, weak: 4, learning: 2, mastered: 0.5 };
  var LEVEL_NAMES = { N1: "Advanced", N2: "Upper Intermediate", N3: "Intermediate", N4: "Elementary", N5: "Beginner" };

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function toDayStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function todayStr(nowMs) {
    var d = (typeof nowMs === "number") ? new Date(nowMs) : new Date();
    return toDayStr(d);
  }
  function parseDay(s) {
    var p = String(s).split("-");
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  function diffDays(aStr, bStr) {
    return Math.round((parseDay(bStr) - parseDay(aStr)) / DAY_MS);
  }
  function addDays(dayStr, n) {
    return toDayStr(new Date(parseDay(dayStr).getTime() + n * DAY_MS));
  }

  /* Exam dates (offline, nothing hardcoded that goes stale).
     JLPT sessions are normally the first Sunday of July and December.
     Upcoming sessions are generated on the fly; EXAM_MONTHS stays
     configurable if the schedule ever changes. */
  var EXAM_MONTHS = [
    { month: 6, name: "July" },
    { month: 11, name: "December" }
  ];
  function firstSunday(year, monthIdx) {
    var dow = new Date(year, monthIdx, 1).getDay();
    return 1 + ((7 - dow) % 7);
  }
  function upcomingExams(today, count) {
    var out = [];
    var want = (typeof count === "number" && count > 0) ? count : 4;
    var year = parseDay(today).getFullYear();
    var y, i, ds;
    for (y = year; y <= year + 2 && out.length < want; y++) {
      for (i = 0; i < EXAM_MONTHS.length && out.length < want; i++) {
        ds = toDayStr(new Date(y, EXAM_MONTHS[i].month, firstSunday(y, EXAM_MONTHS[i].month)));
        if (ds >= today) {
          out.push({ id: y + "-" + pad2(EXAM_MONTHS[i].month + 1),
            label: EXAM_MONTHS[i].name + " " + y + " JLPT", date: ds });
        }
      }
    }
    return out;
  }
  function daysUntil(examDateStr, today) {
    if (!examDateStr) return null;
    return diffDays(today, examDateStr);
  }

  /* Pace suggestion, computed from real content counts, never forced.
     The recommendation is the smallest daily total whose per-type split
     actually finishes every type (kanji/vocabulary/grammar) within the
     available days, so following it covers the planned material. */
  function fitsPace(counts, days, per, weights) {
    var sp = splitDaily(per, weights);
    var pairs = [["kanji", counts.kanji || 0], ["vocab", counts.vocab || 0], ["grammar", counts.grammar || 0]];
    var i;
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i][1] > 0 && sp[pairs[i][0]] <= 0) return false;
      if (Math.ceil(pairs[i][1] / Math.max(1, sp[pairs[i][0]])) > days) return false;
    }
    return true;
  }
  function suggestPace(totals, daysLeft, weights) {
    var counts = { kanji: totals.kanji || 0, vocab: totals.vocab || 0, grammar: totals.grammar || 0 };
    var total = counts.kanji + counts.vocab + counts.grammar;
    var days = (typeof daysLeft === "number" && daysLeft > 0) ? daysLeft : 90;
    var per = Math.ceil(total / days);
    var guard = 0;
    while (!fitsPace(counts, days, per, weights) && guard < 500) { per++; guard++; }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    return {
      total: total,
      daysLeft: (typeof daysLeft === "number" && daysLeft > 0) ? daysLeft : null,
      recommended: clamp(per, 5, 60),
      relaxed: Math.max(5, Math.floor(per * 0.6)),
      intensive: clamp(Math.ceil(per * 1.5), 5, 100)
    };
  }

  /* Curriculum: ordered day buckets referencing content IDs. */
  function normalizeWeights(weights) {
    var w = weights || {};
    function num(v, fb) { v = Number(v); return (v > 0) ? v : fb; }
    return { kanji: num(w.kanji, DEFAULT_WEIGHTS.kanji),
      vocab: num(w.vocab, DEFAULT_WEIGHTS.vocab),
      grammar: num(w.grammar, DEFAULT_WEIGHTS.grammar) };
  }
  function splitDaily(dailyNew, weights) {
    var per = Math.max(1, Math.floor(Number(dailyNew)) || DEFAULT_DAILY_NEW);
    var w = normalizeWeights(weights);
    var keys = ["kanji", "vocab", "grammar"];
    var total = w.kanji + w.vocab + w.grammar;
    var out = {}, frac = [], rem = per, i, k, exact, fl;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      exact = per * w[k] / total;
      fl = Math.floor(exact);
      out[k] = fl;
      frac.push({ k: k, f: exact - fl });
      rem -= fl;
    }
    frac.sort(function (a, b) { return b.f - a.f; });
    for (i = 0; i < frac.length && rem > 0; i++) { out[frac[i].k]++; rem--; }
    if (per >= 3) {
      var big = keys[0], bi;
      for (bi = 1; bi < keys.length; bi++) if (out[keys[bi]] > out[big]) big = keys[bi];
      for (bi = 0; bi < keys.length; bi++) {
        k = keys[bi];
        if (k !== big && out[k] === 0 && out[big] > 1) { out[k] = 1; out[big]--; }
      }
    }
    return out;
  }
  function buildCurriculum(lists, dailyNew, weights) {
    var arrs = { kanji: (lists && lists.kanji) || [], vocab: (lists && lists.vocab) || [],
      grammar: (lists && lists.grammar) || [] };
    var lens = { kanji: arrs.kanji.length, vocab: arrs.vocab.length, grammar: arrs.grammar.length };
    var split = splitDaily(dailyNew, weights);
    var idx = { kanji: 0, vocab: 0, grammar: 0 };
    var keys = ["kanji", "vocab", "grammar"];
    var days = [], guard = 0, j, m, k, remaining, take, i, size;
    var more = (lens.kanji + lens.vocab + lens.grammar) > 0;
    while (more && guard < 100000) {
      guard++;
      more = false;
      var day = { kanji: [], vocab: [], grammar: [] };
      for (j = 0; j < keys.length; j++) {
        k = keys[j];
        remaining = lens[k] - idx[k];
        if (remaining > 0) more = true;
        take = Math.min(remaining, split[k] || 0);
        if (take === 0 && remaining > 0) {
          var othersLeft = false;
          for (m = 0; m < keys.length; m++) {
            if (keys[m] !== k && lens[keys[m]] - idx[keys[m]] > 0) { othersLeft = true; break; }
          }
          if (!othersLeft) take = 1;
        }
        for (i = 0; i < take; i++) day[k].push(arrs[k][idx[k]++]);
      }
      size = day.kanji.length + day.vocab.length + day.grammar.length;
      if (size === 0) break;
      days.push(day);
    }
    return days;
  }
  function dayIndex(startDateStr, today) {
    return Math.max(1, diffDays(startDateStr, today) + 1);
  }
  function unlockedForDay(curriculum, dayIdx) {
    var un = { kanji: [], vocab: [], grammar: [], all: [], total: 0 };
    var n = Math.max(0, Math.min(dayIdx, curriculum.length));
    var d, i, j, k, list;
    var keys = ["kanji", "vocab", "grammar"];
    for (d = 0; d < n; d++) {
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        list = curriculum[d][k] || [];
        for (j = 0; j < list.length; j++) {
          un[k].push(list[j]);
          un.all.push({ type: k, id: list[j], day: d + 1 });
        }
      }
    }
    un.total = un.all.length;
    return un;
  }

  /* Study days + streak (local calendar days, encouraging tone). */
  function recordStudyDay(days, dayStr) {
    var out = (days || []).slice();
    if (out.indexOf(dayStr) < 0) out.push(dayStr);
    out.sort();
    return out;
  }
  function calcStreak(days, today) {
    var set = {}, i;
    for (i = 0; i < (days || []).length; i++) set[days[i]] = 1;
    var cur = today;
    if (!set[cur]) cur = addDays(cur, -1);
    var streak = 0;
    while (set[cur]) { streak++; cur = addDays(cur, -1); }
    return streak;
  }

  /* Quiz selection over the unlocked pool.
     Priority: weak/due items first, newly introduced items always appear,
     mastered items still surface occasionally. Never repeats an item. */
  function classifyItem(ctx) {
    ctx = ctx || {};
    if (!ctx.isLearned && !ctx.inSrs) return "new";
    if (ctx.inSrs && (ctx.box === 0 || ctx.isDue)) return "weak";
    if (ctx.isLearned && ctx.box >= 3) return "mastered";
    return "learning";
  }
  function itemWeight(state) {
    return QUIZ_WEIGHTS[state] != null ? QUIZ_WEIGHTS[state] : 1;
  }
  function shuffleCopy(arr, rand) {
    var a = arr.slice(), i, j, t;
    var rnd = rand || Math.random;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function itemKey(it) { return it.type + ":" + it.id; }
  function selectQuizItems(unlocked, stateOf, count, rand) {
    var rnd = rand || Math.random;
    var pool = (unlocked || []).slice();
    var want = Math.min(count || 10, pool.length);
    if (want <= 0) return [];
    var buckets = { "new": [], weak: [], learning: [], mastered: [] };
    var i, st;
    for (i = 0; i < pool.length; i++) {
      st = stateOf(pool[i]);
      if (!buckets[st]) st = "learning";
      buckets[st].push(pool[i]);
    }
    var picked = [], seen = {};
    function take(it) {
      var k = itemKey(it);
      if (seen[k]) return false;
      seen[k] = 1;
      picked.push(it);
      return true;
    }
    var fresh = shuffleCopy(buckets["new"], rnd);
    var nNew = Math.min(fresh.length, Math.min(3, want));
    for (i = 0; i < nNew; i++) take(fresh[i]);
    var rest = [];
    for (i = 0; i < pool.length; i++) if (!seen[itemKey(pool[i])]) rest.push(pool[i]);
    while (picked.length < want && rest.length > 0) {
      var ws = [], total = 0, j, w;
      for (j = 0; j < rest.length; j++) { w = itemWeight(stateOf(rest[j])); ws.push(w); total += w; }
      var r = rnd() * total, acc = 0, sel = rest.length - 1;
      for (j = 0; j < rest.length; j++) {
        acc += ws[j];
        if (r < acc) { sel = j; break; }
      }
      take(rest[sel]);
      rest.splice(sel, 1);
    }
    return picked;
  }

  /* Progress. */
  function levelProgress(total, learned) {
    var pct = total ? Math.round(learned / total * 100) : 100;
    return { total: total, learned: learned, left: total - learned, pct: pct };
  }
  function courseStats(unlocked, isLearned) {
    var k = 0, v = 0, g = 0, i;
    var un = unlocked || { kanji: [], vocab: [], grammar: [] };
    var ka = un.kanji || [], va = un.vocab || [], ga = un.grammar || [];
    for (i = 0; i < ka.length; i++) if (isLearned("kanji", ka[i])) k++;
    for (i = 0; i < va.length; i++) if (isLearned("vocab", va[i])) v++;
    for (i = 0; i < ga.length; i++) if (isLearned("grammar", ga[i])) g++;
    var ks = levelProgress(ka.length, k);
    var vs = levelProgress(va.length, v);
    var gs = levelProgress(ga.length, g);
    return { kanji: ks, vocab: vs, grammar: gs,
      overall: levelProgress(ks.total + vs.total + gs.total, k + v + g) };
  }
  function courseCompletion(lists, isLearned) {
    var types = ["kanji", "vocab", "grammar"];
    var t = 0, l = 0, i, ti, arr;
    for (ti = 0; ti < types.length; ti++) {
      arr = (lists && lists[types[ti]]) || [];
      t += arr.length;
      for (i = 0; i < arr.length; i++) if (isLearned(types[ti], arr[i])) l++;
    }
    return levelProgress(t, l);
  }
  function todayWorkload(newCount, reviewCount) {
    var n = Math.max(0, newCount || 0), r = Math.max(0, reviewCount || 0);
    return { isNew: n, review: r, total: n + r };
  }

  /* Milestones: small fixed set, easy to extend via MILESTONES + milestoneEarned. */
  function milestoneEarned(id, stats) {
    var s = stats || {};
    switch (id) {
      case "first-session": return (s.studyDays || 0) >= 1;
      case "streak-7": return (s.streak || 0) >= 7;
      case "streak-30": return (s.streak || 0) >= 30;
      case "vocab-100": return (s.vocabLearned || 0) >= 100;
      case "kanji-50": return (s.kanjiLearned || 0) >= 50;
      case "quiz-perfect": return !!s.perfectQuiz;
      case "course-25": return (s.coursePct || 0) >= 25;
      case "course-50": return (s.coursePct || 0) >= 50;
      case "course-done": return (s.coursePct || 0) >= 100;
      default: return false;
    }
  }
  function checkMilestones(stats, already) {
    var have = {}, i;
    for (i = 0; i < (already || []).length; i++) have[already[i]] = 1;
    var fresh = [];
    for (i = 0; i < MILESTONES.length; i++) {
      if (!have[MILESTONES[i].id] && milestoneEarned(MILESTONES[i].id, stats)) fresh.push(MILESTONES[i].id);
    }
    return fresh;
  }
  function milestoneLabel(id) {
    var i;
    for (i = 0; i < MILESTONES.length; i++) if (MILESTONES[i].id === id) return MILESTONES[i].label;
    return id;
  }
  /* Frequency-first ordering: the most useful items surface first.
     Kanji carry a KANJIDIC frequency number (lower = more frequent).
     Vocabulary has no frequency field, so rank by the average frequency of
     the word's kanji; kana-only words use the level median so they mix into
     the middle instead of piling up first or last. Grammar uses its
     frequency category. All sorts are stable: ties keep dataset order. */
  var GRAMMAR_FREQ_ORDER = ["Core Grammar", "Common", "JLPT-Focused", "Literary"];
  function cmpNum(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function stableSortBy(arr, cmp) {
    var dec = [], i;
    for (i = 0; i < arr.length; i++) dec.push({ i: i, v: arr[i] });
    dec.sort(function (a, b) { return cmp(a.v, b.v) || (a.i - b.i); });
    var out = [];
    for (i = 0; i < dec.length; i++) out.push(dec[i].v);
    return out;
  }
  function numFreq(v) { v = Number(v); return (v > 0) ? v : Infinity; }
  function sortKanji(records) {
    return stableSortBy(records || [], function (a, b) { return cmpNum(numFreq(a.freq), numFreq(b.freq)); });
  }
  function avgKanjiFreq(str, freqOfKanji) {
    var map = freqOfKanji || {}, sum = 0, n = 0, i, ch;
    str = String(str == null ? "" : str);
    for (i = 0; i < str.length; i++) {
      ch = str.charAt(i);
      if (map[ch] != null && map[ch] !== Infinity) { sum += map[ch]; n++; }
    }
    return n ? sum / n : null;
  }
  function median(nums) {
    var a = (nums || []).slice().sort(function (x, y) { return x - y; });
    if (!a.length) return Infinity;
    var mid = Math.floor(a.length / 2);
    return (a.length % 2) ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  function sortVocab(records, freqOfKanji, fallbackFreq) {
    var map = freqOfKanji || {};
    var fb = (typeof fallbackFreq === "number") ? fallbackFreq : Infinity;
    return stableSortBy(records || [], function (a, b) {
      var ka = (a.kanji != null && a.kanji !== "") ? a.kanji : a.word;
      var kb = (b.kanji != null && b.kanji !== "") ? b.kanji : b.word;
      var ra = avgKanjiFreq(ka, map);
      var rb = avgKanjiFreq(kb, map);
      var c = cmpNum(ra == null ? fb : ra, rb == null ? fb : rb);
      if (c) return c;
      return cmpNum(String(a.word || "").length, String(b.word || "").length);
    });
  }
  function grammarFreqRank(g) {
    var i = GRAMMAR_FREQ_ORDER.indexOf(g ? g.frequency : "");
    return i < 0 ? GRAMMAR_FREQ_ORDER.length : i;
  }
  function sortGrammar(records) {
    return stableSortBy(records || [], function (a, b) { return cmpNum(grammarFreqRank(a), grammarFreqRank(b)); });
  }
  /* Schedule: curriculum days still locked vs calendar days until the exam.
     Missing a day never deletes material; it only moves the plan behind. */
  function scheduleStatus(curDaysLeft, calDaysLeft) {
    var c = Math.max(0, curDaysLeft || 0);
    if (c <= 0) return { state: "done", behind: 0 };
    if (calDaysLeft == null) return { state: "no-date", behind: 0 };
    if (calDaysLeft < 0) return { state: "passed", behind: 0 };
    if (c <= calDaysLeft) return { state: "on-track", behind: 0 };
    return { state: "behind", behind: c - calDaysLeft };
  }
  function dayPart(hour) {
    var h = Number(hour);
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  }
  function defaultCourse(target) {
    return {
      target: (LEVELS.indexOf(target) >= 0) ? target : "N3",
      examId: "", examLabel: "", examDate: "",
      startDate: todayStr(), dailyNew: DEFAULT_DAILY_NEW, unlockedDay: 1,
      weights: { kanji: DEFAULT_WEIGHTS.kanji, vocab: DEFAULT_WEIGHTS.vocab, grammar: DEFAULT_WEIGHTS.grammar },
      studyDays: [], milestones: [], quizzes: 0, perfectQuiz: false
    };
  }

  return {
    LEVELS: LEVELS,
    LEVEL_NAMES: LEVEL_NAMES,
    dayPart: dayPart,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    DEFAULT_DAILY_NEW: DEFAULT_DAILY_NEW,
    MILESTONES: MILESTONES,
    EXAM_MONTHS: EXAM_MONTHS,
    todayStr: todayStr,
    parseDay: parseDay,
    toDayStr: toDayStr,
    diffDays: diffDays,
    addDays: addDays,
    firstSunday: firstSunday,
    upcomingExams: upcomingExams,
    daysUntil: daysUntil,
    suggestPace: suggestPace,
    normalizeWeights: normalizeWeights,
    splitDaily: splitDaily,
    buildCurriculum: buildCurriculum,
    dayIndex: dayIndex,
    GRAMMAR_FREQ_ORDER: GRAMMAR_FREQ_ORDER,
    sortKanji: sortKanji,
    sortVocab: sortVocab,
    sortGrammar: sortGrammar,
    avgKanjiFreq: avgKanjiFreq,
    median: median,
    grammarFreqRank: grammarFreqRank,
    scheduleStatus: scheduleStatus,
    unlockedForDay: unlockedForDay,
    recordStudyDay: recordStudyDay,
    calcStreak: calcStreak,
    classifyItem: classifyItem,
    itemWeight: itemWeight,
    selectQuizItems: selectQuizItems,
    levelProgress: levelProgress,
    courseStats: courseStats,
    courseCompletion: courseCompletion,
    todayWorkload: todayWorkload,
    milestoneEarned: milestoneEarned,
    checkMilestones: checkMilestones,
    milestoneLabel: milestoneLabel,
    defaultCourse: defaultCourse
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Course;
