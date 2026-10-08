"use strict";
/* Shared practice views. Loaded before app.js; helpers run after its data/store boot. */
function practiceRecord(type, id) {
  return type === "kanji" ? ((DB.byChar[id] || {}).item || null) :
    type === "vocab" ? DB.vById[id] : DB.gById[id];
}
function practiceStats() { return Practice.stats(store.study.days, Course.todayStr(), store.settings.dailyGoal); }
function practiceSession() {
  var s = store.practice.session;
  if (s && !Practice.validSession(s, function (q) { return !!practiceRecord(q.type, q.id); })) {
    store.practice.session = null; save(); return null;
  }
  return s;
}
function recordPracticeAnswer(type, id, ok) {
  var day = studyDay(Course.todayStr());
  day.attempts = (Number(day.attempts) || 0) + 1;
  day.correct = (Number(day.correct) || 0) + (ok ? 1 : 0);
  day.practiced = day.practiced || {};
  day.practiced[type + ":" + id] = true;
  day.reviewed = day.reviewed || {};
  day.reviewed[type + ":" + id] = true;
  var key = type + ":" + id;
  if (ok) delete store.practice.mistakes[key];
  else {
    var previous = store.practice.mistakes[key] || {};
    store.practice.mistakes[key] = { type: type, id: id, misses: (previous.misses || 0) + 1, lastMissed: Date.now() };
  }
  updatePracticeBadges();
  Reminders.syncGoal();
}
function updatePracticeBadges() {
  var fresh = Practice.earned(practiceStats(), store.practice.badges);
  store.practice.badges = store.practice.badges.concat(fresh);
}
function practiceBadgesHTML() {
  return '<div class="mile-grid">' + Practice.BADGES.map(function (b) {
    var got = store.practice.badges.includes(b.id);
    return '<span class="mile' + (got ? ' got' : '') + '" title="' + esc(b.hint) + '">' +
      (got ? '&#10003; ' : '') + esc(b.label) + '</span>';
  }).join('') + '</div>';
}
function practiceDashboardHTML() { return dailyPracticeCardHTML(); }

function practiceSettingsHTML() {
  return '<div class="card"><h2>Daily practice</h2><label for="practiceGoal">Items to practice each day</label> ' +
    '<select id="practiceGoal">' + [3, 5, 10, 20].map(function (n) {
      return '<option value="' + n + '"' + (Practice.goal(store.settings.dailyGoal) === n ? ' selected' : '') + '>' + n + '</option>';
    }).join('') + '</select><p class="explain">Newly studied items and review attempts count. Each item counts once a day, even when you miss it. This goal is separate from your plan’s new-material pace.</p></div>';
}
function practicePool(cfg) {
  if (cfg.mode === 'plan' || (cfg.mode === 'smart' && store.course && cfg.lv === store.course.target)) {
    if (!store.course) return [];
    var un = courseUnlocked().all.map(function (item) { return Object.assign({ lv: cfg.lv }, item); });
    // Previously learned material stays reviewable, even if outside the current batch.
    if (cfg.mode === 'smart') {
      Practice.TYPES.forEach(function (type) {
        var recs = type === 'kanji' ? DB.levels[cfg.lv] : type === 'vocab' ? DB.vocab[cfg.lv] : DB.grammar[cfg.lv];
        (recs || []).forEach(function (r) {
          var id = type === 'kanji' ? r.k : r.id;
          if (courseIsLearned(type, id) || courseSrsOf(type, id).inSrs) un.push({ type: type, id: id, lv: cfg.lv });
        });
      });
    }
    return un;
  }
  var out = [], levels = cfg.mode === 'due' || cfg.mode === 'mistakes' ? LEVELS : [cfg.lv];
  levels.forEach(function (lv) {
    Practice.TYPES.forEach(function (type) {
      var recs = type === 'kanji' ? DB.levels[lv] : type === 'vocab' ? DB.vocab[lv] : DB.grammar[lv];
      (recs || []).forEach(function (r) { out.push({ type: type, id: type === 'kanji' ? r.k : r.id, lv: lv }); });
    });
  });
  return out;
}
function practiceSrs(item) {
  var s = courseSrsOf(item.type, item.id);
  var map = item.type === 'kanji' ? store.srs : item.type === 'vocab' ? store.vSrs : store.gSrs;
  s.due = (map[item.id] || {}).due || 0;
  return s;
}
function renderPractice(view, query) {
  var cfg = Practice.config(query, (store.course || {}).target || 'N5');
  var saved = practiceSession();
  if (query.resume === '1' && saved) { renderPracticePlayer(view, saved); return; }
  // A start link always resumes an existing session; replacing it is an explicit choice.
  if (query.start === '1' && saved) { renderPracticePlayer(view, saved); return; }
  if (query.start === '1') { startPractice(view, cfg); return; }
  var counts = {};
  ['smart', 'due', 'mistakes', 'plan'].forEach(function (mode) {
    var c = Object.assign({}, cfg, { mode: mode, size: 10 });
    var seen = {};
    counts[mode] = practicePool(c).filter(function (item) {
      var key = Practice.key(item);
      if (seen[key]) return false;
      seen[key] = true;
      return (c.kind === 'mixed' || c.kind === item.type) &&
        (mode !== 'due' || (practiceSrs(item).inSrs && practiceSrs(item).isDue)) &&
        (mode !== 'mistakes' || !!store.practice.mistakes[key]);
    }).length;
  });
  var options = function (values, selected) { return values.map(function (v) {
    return '<option value="' + esc(v[0]) + '"' + (v[0] === selected ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
  }).join(''); };
  var last = store.practice.history[store.practice.history.length - 1];
  var quick = practiceQuickChoicesHTML(cfg,counts,!!saved);
  view.innerHTML = '<h1>Daily practice</h1><p class="explain">A small session, one clear finish. Choose what fits today.</p>' +
    (saved ? '<section class="card"><h2>Your saved session</h2><p>' + saved.answers.length + ' / ' + saved.questions.length +
      ' answered. Your place is saved on this device.</p><div class="practice-actions"><button class="btn primary" id="practiceResume">Resume session</button>' +
      '<button class="btn soft" id="practiceReplace">Start a different session</button></div></section>' : '') +
    quick + '<form class="card practice-form" id="practiceForm"><details class="practice-custom"' + (query.kind || query.lv || cfg.mode === 'plan' ? ' open' : '') + '><summary>Build your own session</summary><div class="practice-fields">' +
    '<label>Focus<select name="mode">' + options([['smart', 'Smart mix'], ['explore', 'Level sampler'], ['due', 'Due reviews (' + counts.due + ')'],
      ['mistakes', 'Mistakes (' + counts.mistakes + ')']].concat(store.course ? [['plan', 'Study plan']] : []), cfg.mode) + '</select></label>' +
    '<label>Content<select name="kind">' + options([['mixed', 'Mixed'], ['kanji', 'Kanji'], ['vocab', 'Vocabulary'], ['grammar', 'Grammar']], cfg.kind) + '</select></label>' +
    '<label>Level<select name="lv">' + options(LEVELS.map(function (lv) { return [lv, lv]; }), cfg.lv) + '</select></label>' +
    '<label>Session length<select name="size">' + options([['3', '3 questions · small start'], ['5', '5 questions · daily practice'], ['10', '10 questions · deeper practice']], String(cfg.size)) + '</select></label>' +
    '<label>Practice style<select name="format">' + options([['quiz', 'Multiple choice'], ['recall', 'Recall cards']], cfg.format) + '</select></label></div>' +
    '<p class="explain">Due reviews and mistakes include all levels. Study plan questions stay within unlocked material. Recall cards let you think before revealing the answer.</p>' +
    '<button class="btn primary" type="submit"' + (saved ? ' disabled' : '') + '>Start session</button></details></form>' +
    (last ? '<section class="card"><h2>Last session</h2><p>' + esc(last.date) + ' &middot; ' + last.score + ' / ' + last.total +
      ' ' + (last.format === 'recall' ? 'remembered' : 'correct') + '</p><p class="explain">' + last.total + ' attempts made. Every session builds your practice habit.</p></section>' : '') + practiceDashboardHTML();
  $$('[data-quick-practice]',view).forEach(function(button) {
    button.addEventListener('click',function() {
      if(store.practice.session)return;
      var choices={smart:{mode:'smart'},due:{mode:'due'},mistakes:{mode:'mistakes'},recall:{mode:'smart',format:'recall'}};
      startPractice(view,Practice.config(Object.assign({},cfg,choices[button.dataset.quickPractice],{size:3}),cfg.lv));
    });
  });
  var form = $('#practiceForm', view);
  function formConfig() {
    var data = new FormData(form), q = {};
    data.forEach(function (v, k) { q[k] = v; });
    var c = Practice.config(q, cfg.lv);
    if (c.mode === 'plan' && store.course) c.lv = store.course.target;
    return c;
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); if (!store.practice.session) startPractice(view, formConfig()); });
  if (saved) {
    $('#practiceResume', view).addEventListener('click', function () { renderPracticePlayer(view, saved); });
    $('#practiceReplace', view).addEventListener('click', function () {
      if (!confirm('Replace this saved session? Your answered items and progress will stay.')) return;
      store.practice.session = null; save(); startPractice(view, formConfig());
    });
  }
}
function startPractice(view, cfg) {
  var pool = practicePool(cfg);
  var picked = Practice.select(pool, cfg, practiceSrs, store.practice.mistakes, courseStateOf);
  var questions = picked.map(function (item) {
    if (cfg.format === 'recall') return Object.assign({}, item, { variant: 0, options: [] });
    var built = courseBuildQuestion(item, item.lv, undefined);
    return built ? { type: item.type, id: item.id, lv: item.lv, variant: built.variant,
      options: built.opts.map(function (r) { return courseQuizKey(built, r); }) } : null;
  }).filter(Boolean);
  if (!questions.length) {
    var msg = cfg.mode === 'due' ? 'You are caught up. Nothing is due for this content right now.' :
      cfg.mode === 'mistakes' ? 'No mistakes waiting for practice. You can try a smart mix when you feel ready.' :
      'No questions available for this selection. Try recall cards or study a few items first.';
    view.innerHTML = '<h1>Daily practice</h1><section class="card"><h2>All clear</h2><p>' + msg +
      '</p><div class="practice-actions"><a class="btn soft" href="#/practice">Choose practice</a><a class="btn soft" href="#/learn">Browse lessons</a></div></section>';
    return;
  }
  var s = { version: 1, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), config: cfg,
    questions: questions, cursor: 0, answers: [], startedAt: Date.now(), startingBadges: store.practice.badges.slice() };
  store.practice.session = s; save(); renderPracticePlayer(view, s);
}
function practiceHydrate(q) {
  return { type: q.type, id: q.id, variant: q.variant, head: practiceRecord(q.type, q.id),
    opts: q.options.map(function (id) { return practiceRecord(q.type, id); }) };
}
function renderPracticePlayer(view, s) {
  if (s.config.format === 'recall') { renderRecallPlayer(view, s); return; }
  if (s.cursor >= s.questions.length) { finishPractice(view, s); return; }
  var cursor = s.cursor;
  var ref = s.questions[s.cursor], q = practiceHydrate(ref), answer = s.answers[s.cursor];
  var total = s.questions.length;
  view.innerHTML = '<h1>Practice session</h1><div class="practice-heading"><p class="explain">' +
    (s.cursor + 1) + ' of ' + total + ' &middot; ' + esc(ref.lv) + ' ' + courseTypeName(q.type) +
    '</p><a href="#/practice" id="practicePause">Pause &amp; save</a></div>' + progressBar(Math.round(s.answers.length / total * 100), "Practice session completion") + pengoPracticeCoachHTML(false) +
    '<div id="practiceBody"><section class="card practice-question">' + '<p class="quiz-q">' + courseQuizPrompt(q) + '</p>' +
    '<div class="quiz-opts">' + q.opts.map(function (o) {
        return '<button class="btn quiz-opt" data-answer="' + esc(courseQuizKey(q, o)) + '"' + (q.variant === 0 || q.variant === 2 && q.type === 'grammar' ? '' : ' lang="ja"') + '>' +
          esc(courseQuizOptionLabel(q, o)) + '</button>';
      }).join('') + '</div>' + '<p id="qFb" class="explain" role="status" aria-live="polite"></p></section></div>';
  var body = $('#practiceBody', view);
  $('#practicePause', view).addEventListener('click', function (e) { e.preventDefault(); save(); go('#/practice'); });
  function grade(ok, selected) {
    if (s.cursor !== cursor || s.answers[s.cursor] || store.practice.session !== s) return;
    s.answers[s.cursor] = { ok: ok, selected: selected };
    courseGrade(q.type, q.id, ok);
    save(); feedback(s.answers[s.cursor]);
    renderNav('review');
  }
  function feedback(a) {
    $$('[data-answer]', body).forEach(function (b) {
      b.disabled = true;
      if (b.dataset.answer === q.id) b.classList.add('correct');
      else if (b.dataset.answer === a.selected) b.classList.add('wrong');
    });
    var next = document.createElement('button');
    next.className = 'btn primary'; next.id = 'practiceNext';
    next.textContent = s.cursor + 1 === total ? 'Finish session' : 'Next question';
    next.addEventListener('click', function () {
      if (store.practice.session !== s || s.cursor !== cursor) return;
      s.cursor++; save(); renderPracticePlayer(view, s);
    });
    showQuizAnswer(body, a.ok, q.type, q.head, next);
    body.insertBefore(next, $(".quiz-review", body));
    $('#practiceCoachImage',view).src = a.ok ? 'assets/pengo-happy.png' : 'assets/pengo-study.png';
    $('#practiceCoachText',view).textContent = a.ok ? 'Nice work! That’s one more little win.' : 'We’re learning. Let’s give this one another look.';
    body.classList.add(a.ok ? 'answer-win' : 'answer-learn');
    $('#qFb', body).textContent = a.ok ? 'Correct! Your review schedule is updated.' : 'Not quite. Here is the answer and a quick explanation.';
    next.focus({ preventScroll: true });
  }
  if (answer) { feedback(answer); return; }
  $$('[data-answer]', body).forEach(function (b) {
    b.addEventListener('click', function () { grade(b.dataset.answer === q.id, b.dataset.answer); });
  });
}
function finishPractice(view, s) {
  var score = s.answers.filter(function (a) { return a.ok; }).length;
  var missed = s.questions.filter(function (q, i) { return !s.answers[i].ok; });
  var fresh = store.practice.badges.filter(function (b) { return !(s.startingBadges || []).includes(b); });
  if (!store.practice.history.some(function (h) { return h.id === s.id; })) {
    store.practice.history.push({ id: s.id, date: Course.todayStr(), score: score, total: s.questions.length,
      format: s.config.format, mode: s.config.mode, lv: s.config.lv });
    store.practice.history = store.practice.history.slice(-60);
    if (s.config.mode === 'plan' && store.course && store.course.target === s.config.lv) {
      store.course.quizzes = (store.course.quizzes || 0) + 1;
      if (score === s.questions.length) store.course.perfectQuiz = true;
    }
    // Preserve the old raw-score records only for ten-question single-kind quizzes.
    if (s.config.format === 'quiz' && s.config.kind !== 'mixed' && s.questions.length === 10 && s.questions.every(function (q) { return q.lv === s.config.lv; })) {
      var best = s.config.kind === 'kanji' ? store.quizBest : s.config.kind === 'vocab' ? store.vQuizBest : store.gQuizBest;
      best[s.config.lv] = Math.max(best[s.config.lv] || 0, score);
    }
    courseCheckMilestones();
  }
  store.practice.session = null; save(); renderNav('review');
  var stats = practiceStats();
  var bestMap = s.config.kind === 'kanji' ? store.quizBest : s.config.kind === 'vocab' ? store.vQuizBest : store.gQuizBest;
  var bestText = s.config.format === 'quiz' && s.config.kind !== 'mixed' && s.questions.length === 10 && s.questions.every(function (q) { return q.lv === s.config.lv; })
    ? '<p class="explain">Best on ' + esc(s.config.lv) + ': ' + bestMap[s.config.lv] + ' / 10</p>' : '';
  view.innerHTML = '<h1>Session complete</h1><section class="card quiz-result good">' + pengoCelebrationHTML() + '<img class="quiz-result-img" src="assets/pengo-happy.png" alt="Pengo celebrating your practice">' +
    '<h2>You showed up. That counts.</h2><div class="result-stats"><div><strong>' + s.questions.length + '</strong><span>attempts made</span></div><div><strong>' + score + ' / ' + s.questions.length + '</strong><span>' + (s.config.format === 'recall' ? 'remembered' : 'correct') + '</span></div><div><strong>' + stats.streak + '</strong><span>day streak</span></div></div><p class="explain">' +
    (s.config.format === 'recall' ? 'Self-rated recall: ' : '') + score + ' ' + (s.config.format === 'recall' ? 'remembered' : 'correct') +
    ', ' + missed.length + ' to keep practicing.</p>' + bestText + '<p>' + stats.done + ' / ' + stats.goal + ' items practiced today.</p>' +
    '<p class="explain">' + (stats.goalMet ? 'Daily goal complete. This is a good place to stop.' : 'A small session is still progress. Come back when it fits your day.') + '</p>' +
    (fresh.length ? '<p>New achievement: ' + fresh.map(function (id) { return esc(Practice.BADGES.find(function (b) { return b.id === id; }).label); }).join(', ') + '</p>' : '') +
    '<div class="practice-actions"><a class="btn primary" href="#/">Done for now</a>' +
    (missed.length ? '<a class="btn soft" href="#/practice?mode=mistakes">Practice mistakes</a>' : '<a class="btn soft" href="#/practice">Choose another session</a>') + '</div></section>' +
    (missed.length ? '<section class="card"><h2>What to revisit</h2><p class="explain">These items are saved in Mistakes. Correctly recalling them clears that list.</p>' +
      missed.map(function (q) { return courseItemRow(q.type, q.id, false); }).join('') + '</section>' : '');
  view.focus({ preventScroll: true }); window.scrollTo(0, 0);
}
