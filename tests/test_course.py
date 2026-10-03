"""Tests for course.js (JLPT course / daily learning system).

Loads the real course.js in a JS engine (dukpy) and runs assertions against
it, so the browser code itself is what gets tested - no logic duplication.
Run:  pip install dukpy && python tests/test_course.py
"""
import json
import os
import sys

DRIVER = r"""
var failures = [];
var passed = 0;
function t(name, cond) {
  if (cond) { passed++; }
  else { failures.push(name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function seq(n) { var a = []; for (var i = 0; i < n; i++) a.push("id" + i); return a; }

/* dates */
t("today-format", /^\d{4}-\d{2}-\d{2}$/.test(Course.todayStr()));
t("diff-same", Course.diffDays("2026-09-27", "2026-09-27") === 0);
t("diff-plus", Course.diffDays("2026-09-27", "2026-09-28") === 1);
t("diff-month", Course.diffDays("2026-09-27", "2026-12-06") === 70);
t("add", Course.addDays("2026-09-27", 70) === "2026-12-06");
t("add-neg", Course.addDays("2026-09-28", -1) === "2026-09-27");
t("dayindex-same", Course.dayIndex("2026-09-27", "2026-09-27") === 1);
t("dayindex-next", Course.dayIndex("2026-09-27", "2026-09-28") === 2);
t("dayindex-past", Course.dayIndex("2026-09-28", "2026-09-27") === 1);

/* exams: generated, ordered, Sundays, no stale past dates */
var ex = Course.upcomingExams("2026-09-27", 3);
t("exam-count", ex.length === 3);
t("exam-first", ex[0].date === "2026-12-06" && ex[0].label === "December 2026 JLPT");
t("exam-order", ex[0].date < ex[1].date && ex[1].date < ex[2].date);
t("exam-sunday", ex.every(function (e) { return Course.parseDay(e.date).getDay() === 0; }));
var ex2 = Course.upcomingExams("2026-12-07", 2);
t("exam-past-skipped", ex2[0].date === "2027-07-04");
t("days-until", Course.daysUntil("2026-12-06", "2026-09-27") === 70);
t("days-until-past", Course.daysUntil("2026-07-05", "2026-09-27") < 0);
t("days-until-none", Course.daysUntil("", "2026-09-27") === null);

/* pace suggestion from real-scale counts */
var pace = Course.suggestPace({ kanji: 361, vocab: 1730, grammar: 100 }, 70);
t("pace-total", pace.total === 2191);
t("pace-rec", pace.recommended === 50);
t("pace-finishes", Course.buildCurriculum({ kanji: seq(361), vocab: seq(1730), grammar: seq(100) }, pace.recommended, null).length <= 70);
t("pace-weights", Course.suggestPace({ kanji: 10, vocab: 10, grammar: 10 }, 5, { kanji: 1, vocab: 1, grammar: 1 }).recommended === 6);
t("pace-order", pace.relaxed <= pace.recommended && pace.recommended <= pace.intensive);
var paceNone = Course.suggestPace({ kanji: 103, vocab: 684, grammar: 79 }, null);
t("pace-nodate", paceNone.daysLeft === null && paceNone.recommended === 16);

/* daily split */
var sp = Course.splitDaily(20, { kanji: 3, vocab: 5, grammar: 2 });
t("split-sum", sp.kanji + sp.vocab + sp.grammar === 20);
t("split-default", sp.kanji === 6 && sp.vocab === 10 && sp.grammar === 4);
var sp2 = Course.splitDaily(10, { kanji: 1, vocab: 1, grammar: 1 });
t("split-even", sp2.kanji + sp2.vocab + sp2.grammar === 10);
t("split-min-one", sp2.kanji >= 1 && sp2.vocab >= 1 && sp2.grammar >= 1);
"""

DRIVER2 = r"""
/* curriculum covers everything exactly once, bounded day sizes */
var lists = { kanji: seq(7), vocab: seq(23), grammar: seq(5) };
var cur = Course.buildCurriculum(lists, 10, { kanji: 3, vocab: 5, grammar: 2 });
var flat = { kanji: [], vocab: [], grammar: [] };
var okSize = true, d;
for (d = 0; d < cur.length; d++) {
  var sz = cur[d].kanji.length + cur[d].vocab.length + cur[d].grammar.length;
  if (sz > 10 || sz === 0) okSize = false;
  flat.kanji = flat.kanji.concat(cur[d].kanji);
  flat.vocab = flat.vocab.concat(cur[d].vocab);
  flat.grammar = flat.grammar.concat(cur[d].grammar);
}
function uniq(a) { var s = {}, u = []; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = 1; u.push(a[i]); } return u; }
t("curr-covers-kanji", eq(flat.kanji, lists.kanji));
t("curr-covers-vocab", eq(flat.vocab, lists.vocab));
t("curr-covers-grammar", eq(flat.grammar, lists.grammar));
t("curr-day-size", okSize);
t("curr-day1-mix", cur[0].kanji.length === 3 && cur[0].vocab.length === 5 && cur[0].grammar.length === 2);
t("curr-uneven", (function () {
  var c2 = Course.buildCurriculum({ kanji: seq(2), vocab: [], grammar: seq(1) }, 10, null);
  var n = 0, dd;
  for (dd = 0; dd < c2.length; dd++) n += c2[dd].kanji.length + c2[dd].grammar.length;
  return n === 3 && c2.length >= 1;
})());
t("curr-empty", Course.buildCurriculum({ kanji: [], vocab: [], grammar: [] }, 10, null).length === 0);

/* unlocking */
var un1 = Course.unlockedForDay(cur, 1);
t("unlock-day1", un1.total === 10 && un1.kanji.length === 3 && un1.vocab.length === 5 && un1.grammar.length === 2);
var unAll = Course.unlockedForDay(cur, 9999);
t("unlock-end", unAll.total === 35);
var un0 = Course.unlockedForDay(cur, 0);
t("unlock-zero", un0.total === 0);
var un2 = Course.unlockedForDay(cur, 2);
t("unlock-grows", un2.total > un1.total);
t("unlock-day-tag", un1.all[0].day === 1);

/* streak */
t("streak-first", Course.calcStreak(["2026-09-27"], "2026-09-27") === 1);
t("streak-3", Course.calcStreak(["2026-09-25", "2026-09-26", "2026-09-27"], "2026-09-27") === 3);
t("streak-missed", Course.calcStreak(["2026-09-25", "2026-09-26", "2026-09-28"], "2026-09-28") === 1);
t("streak-sameday", Course.calcStreak(["2026-09-27", "2026-09-27"], "2026-09-27") === 1);
t("streak-empty", Course.calcStreak([], "2026-09-27") === 0);
t("streak-yesterday", Course.calcStreak(["2026-09-25", "2026-09-26"], "2026-09-27") === 2);
t("streak-gap", Course.calcStreak(["2026-09-20", "2026-09-26", "2026-09-27"], "2026-09-27") === 2);
t("record-day", eq(Course.recordStudyDay(["2026-09-27"], "2026-09-27"), ["2026-09-27"]));
t("record-add", eq(Course.recordStudyDay(["2026-09-28"], "2026-09-27"), ["2026-09-27", "2026-09-28"]));

/* quiz selection */
t("class-new", Course.classifyItem({ isLearned: false, inSrs: false, box: 0, isDue: false }) === "new");
t("class-weak-due", Course.classifyItem({ isLearned: true, inSrs: true, box: 2, isDue: true }) === "weak");
t("class-weak-box0", Course.classifyItem({ isLearned: false, inSrs: true, box: 0, isDue: false }) === "weak");
t("class-mastered", Course.classifyItem({ isLearned: true, inSrs: true, box: 3, isDue: false }) === "mastered");
t("class-learning", Course.classifyItem({ isLearned: true, inSrs: true, box: 1, isDue: false }) === "learning");
t("weight-order", Course.itemWeight("new") > Course.itemWeight("weak") &&
  Course.itemWeight("weak") > Course.itemWeight("learning") &&
  Course.itemWeight("learning") > Course.itemWeight("mastered"));
function mkItems(n, type) { var a = []; for (var i = 0; i < n; i++) a.push({ type: type, id: type + i }); return a; }
function zeroRand() { return 0; }
var pool = mkItems(6, "kanji").concat(mkItems(6, "vocab")).concat(mkItems(4, "grammar"));
var states = {};
pool.forEach(function (it, i) {
  if (i < 5) states[it.type + ":" + it.id] = "new";
  else if (i < 9) states[it.type + ":" + it.id] = "weak";
  else if (i < 13) states[it.type + ":" + it.id] = "learning";
  else states[it.type + ":" + it.id] = "mastered";
});
function stateOf(it) { return states[it.type + ":" + it.id]; }
var sel = Course.selectQuizItems(pool, stateOf, 10, zeroRand);
t("quiz-count", sel.length === 10);
t("quiz-subset", sel.every(function (it) {
  return pool.some(function (p) { return p.type === it.type && p.id === it.id; });
}));
t("quiz-nodupe", (function () { var s = {}, ok = true; sel.forEach(function (it) { var k = it.type + ":" + it.id; if (s[k]) ok = false; s[k] = 1; }); return ok; })());
t("quiz-new-appear", sel.some(function (it) { return stateOf(it) === "new"; }));
t("quiz-weak-priority", (function () {
  var small = [{ type: "kanji", id: "m0" }, { type: "kanji", id: "w0" }];
  var st = { "kanji:m0": "mastered", "kanji:w0": "weak" };
  function halfRand() { return 0.5; }
  var got = Course.selectQuizItems(small, function (it) { return st[it.type + ":" + it.id]; }, 1, halfRand);
  return got.length === 1 && got[0].id === "w0";
})());
t("quiz-overflow", Course.selectQuizItems(mkItems(3, "kanji"), stateOf, 10, zeroRand).length === 3);
t("quiz-empty", Course.selectQuizItems([], stateOf, 10, zeroRand).length === 0);

/* progress */
var st2 = Course.courseStats({ kanji: ["a", "b"], vocab: ["w1", "w2", "w3"], grammar: ["g1"] },
  function (type, id) { return id === "a" || id === "w1" || id === "w2"; });
t("stats-kanji", st2.kanji.learned === 1 && st2.kanji.pct === 50);
t("stats-overall", st2.overall.learned === 3 && st2.overall.total === 6 && st2.overall.pct === 50);
t("stats-empty", Course.courseStats({ kanji: [], vocab: [], grammar: [] }, function () { return false; }).overall.pct === 100);
var comp = Course.courseCompletion({ kanji: ["a", "b"], vocab: ["w"], grammar: [] },
  function (type, id) { return id === "a"; });
t("completion", comp.total === 3 && comp.learned === 1 && comp.pct === 33);
var wl = Course.todayWorkload(15, 12);
t("workload", wl.isNew === 15 && wl.review === 12 && wl.total === 27);

/* milestones */
t("ms-first", Course.checkMilestones({ studyDays: 1 }, []).indexOf("first-session") >= 0);
t("ms-streak7-no", Course.checkMilestones({ streak: 6 }, []).indexOf("streak-7") < 0);
t("ms-streak7", Course.checkMilestones({ streak: 7 }, []).indexOf("streak-7") >= 0);
t("ms-vocab", Course.checkMilestones({ vocabLearned: 100 }, []).indexOf("vocab-100") >= 0);
t("ms-kanji", Course.checkMilestones({ kanjiLearned: 50 }, []).indexOf("kanji-50") >= 0);
t("ms-perfect", Course.checkMilestones({ perfectQuiz: true }, []).indexOf("quiz-perfect") >= 0);
t("ms-course25", Course.checkMilestones({ coursePct: 30 }, []).indexOf("course-25") >= 0);
t("ms-course25-no", Course.checkMilestones({ coursePct: 24 }, []).indexOf("course-25") < 0);
t("ms-done", Course.checkMilestones({ coursePct: 100 }, []).indexOf("course-done") >= 0);
t("ms-norepeat", Course.checkMilestones({ studyDays: 5 }, ["first-session"]).indexOf("first-session") < 0);
t("ms-label", Course.milestoneLabel("streak-7") === "7 day streak");

/* default course */
var dc = Course.defaultCourse("N4");
t("dc-target", dc.target === "N4");
t("dc-bad-target", Course.defaultCourse("N9").target === "N3");
t("dc-weights-copy", (function () { dc.weights.kanji = 99; return Course.DEFAULT_WEIGHTS.kanji === 3; })());

/* frequency-first ordering */
var kr = Course.sortKanji([{ k: "c", freq: 500 }, { k: "a", freq: 2 }, { k: "b" }, { k: "d", freq: 2 }]);
t("kanji-freq", kr[0].k === "a" && kr[1].k === "d" && kr[2].k === "c" && kr[3].k === "b");
t("median-odd", Course.median([3, 1, 2]) === 2);
t("median-even", Course.median([4, 1, 2, 3]) === 2.5);
t("median-empty", Course.median([]) === Infinity);
var fmap = { A: 10, B: 20, C: 30 };
t("avgfreq", Course.avgKanjiFreq("AB", fmap) === 15);
t("avgfreq-none", Course.avgKanjiFreq("xyz", fmap) === null);
var vr = Course.sortVocab([
  { word: "zz", kanji: "C" },
  { word: "kana", kanji: "" },
  { word: "ab", kanji: "AB" },
  { word: "a", kanji: "A" }
], fmap, 15);
t("vocab-freq", vr.map(function (w) { return w.word; }).join(",") === "a,ab,kana,zz");
var gr = Course.sortGrammar([
  { point: "lit", frequency: "Literary" },
  { point: "com", frequency: "Common" },
  { point: "core", frequency: "Core Grammar" },
  { point: "unk", frequency: "Whatever" },
  { point: "jlpt", frequency: "JLPT-Focused" }
]);
t("grammar-freq", gr.map(function (g) { return g.point; }).join(",") === "core,com,jlpt,lit,unk");
t("sched-done", Course.scheduleStatus(0, 10).state === "done");
t("sched-nodate", Course.scheduleStatus(5, null).state === "no-date");
t("sched-passed", Course.scheduleStatus(5, -3).state === "passed");
t("sched-ontrack", Course.scheduleStatus(5, 10).state === "on-track");
var sb = Course.scheduleStatus(70, 60);
t("sched-behind", sb.state === "behind" && sb.behind === 10);

t("level-names", Course.LEVELS.every(function (lv) { return !!Course.LEVEL_NAMES[lv]; }));
t("daypart-morning", Course.dayPart(9) === "morning" && Course.dayPart(0) === "morning");
t("daypart-afternoon", Course.dayPart(12) === "afternoon" && Course.dayPart(17) === "afternoon");
t("daypart-evening", Course.dayPart(18) === "evening" && Course.dayPart(23) === "evening");

JSON.stringify({ passed: passed, failures: failures });
"""

def main():
    try:
        import dukpy
    except ImportError:
        print("SKIP: dukpy not installed (pip install dukpy)")
        return 0
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "course.js"), encoding="utf-8") as f:
        src = f.read()
    result = dukpy.evaljs(src + DRIVER + DRIVER2)
    data = json.loads(result)
    print("course.js tests: %d passed, %d failed" % (data["passed"], len(data["failures"])))
    for name in data["failures"]:
        print("FAIL:", name)
    return 1 if data["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
