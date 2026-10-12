"use strict";
/* Shared practice views. Loaded before app.js; helpers run after its data/store boot. */
function practiceRecord(type, id) {
  return type === "kanji" ? ((DB.byChar[id] || {}).item || null) :
    type === "vocab" ? DB.vById[id] : DB.gById[id];
}
function practiceStats() { return Practice.stats(store.study.days, Course.todayStr(), store.settings.dailyGoal); }
function practiceSession(slot) {
  slot = slot || 'session';
  var s = store.practice[slot];
  if (s && (!Practice.validSession(s, function (q) { return !!practiceRecord(q.type, q.id); }) ||
      (store.course && s.questions.some(function (q) { return q.lv !== store.course.target; })) ||
      (s.config.challenge && s.config.challengeDate !== Course.todayStr()))) {
    store.practice[slot] = null;
    if (slot !== 'returnSession' && s.config && s.config.challenge) {
      store.practice[slot] = practiceSession('returnSession'); store.practice.returnSession = null;
    }
    save(); return store.practice[slot];
  }
  return s;
}
function resumePausedPractice(view) {
  var paused = practiceSession('pausedSession');
  if (!paused) return;
  store.practice.pausedSession = practiceSession();
  store.practice.session = paused;
  save(); renderPracticePlayer(view, paused);
}
function openPracticeFormat(view, cfg) {
  if (window.OnboardingTour && OnboardingTour.active) { OnboardingTour.showPreview(view, cfg); return; }
  var current = practiceSession(), paused = practiceSession('pausedSession');
  if (current && current.config.format === cfg.format) { renderPracticePlayer(view, current); return; }
  if (paused && paused.config.format === cfg.format) { resumePausedPractice(view); return; }
  // Quiz and flashcard progress can coexist. Switching never overwrites the other format.
  if (current) {
    store.practice.pausedSession = current;
    store.practice.session = null;
    save();
  }
  startPractice(view, cfg);
}
function renderFlashcards(view, query) {
  if (window.OnboardingTour && OnboardingTour.active) {
    var tourKind = query.kind;
    if (query.challenge) {
      var tourChallenge = Dashboard.challenges(store.study.days, Course.todayStr(), store.settings.dailyGoal, studyLevel(query.lv)).find(function (q) { return q.id === query.challenge; });
      if (tourChallenge) tourKind = tourChallenge.kind;
    }
    OnboardingTour.showPreview(view, { format: 'recall', kind: tourKind, lv: studyLevel(query.lv), source: query.challenge ? 'challenge-' + query.challenge : 'cards' }); return;
  }
  if (query.challenge) { startChallengePractice(view, query.challenge, studyLevel(query.lv)); return; }
  var current = practiceSession(), paused = practiceSession('pausedSession');
  var deck = current && current.config.format === 'recall' ? current : paused && paused.config.format === 'recall' ? paused : null;
  var cfg = Practice.config(Object.assign({ mode: 'explore', kind: 'kanji', size: 3 }, query, { format: 'recall' }), studyLevel(query.lv));
  cfg.lv = studyLevel(cfg.lv);
  if (query.daily === '1' || (!query.start && !query.resume && query.choose !== '1')) {
    cfg = dailyFlashcardConfig(cfg.lv);
    openPracticeFormat(view, cfg); return;
  }
  if (query.start === '1' || query.resume === '1') { openPracticeFormat(view, cfg); return; }
  view.innerHTML = '<div class="flashcards-hub"><span class="eyebrow">GUESS · FLIP · REMEMBER</span><h1>Learn one card at a time</h1>' +
    '<p>One card at a time. Guess the meaning, tap to flip, then choose how confident you feel and swipe to the next card.</p>' +
    '<form class="card" id="flashcardsForm"><h2>' + (deck ? 'Your saved deck' : 'Pick a little deck') + '</h2>' +
    (deck ? '<p>' + deck.answers.length + ' / ' + deck.questions.length + ' cards rated. Continue where you left off.</p>' : '') +
    '<div class="practice-fields"><label>Content<select name="kind"' + (deck ? ' disabled' : '') + '>' +
    [['kanji', 'Kanji'], ['vocab', 'Vocabulary'], ['grammar', 'Grammar'], ['mixed', 'A little of everything']].map(function (option) {
      return '<option value="' + option[0] + '"' + (option[0] === (deck ? deck.config.kind : cfg.kind) ? ' selected' : '') + '>' + option[1] + '</option>';
    }).join('') + '</select></label><label>Level<select name="lv"' + (deck ? ' disabled' : '') + '>' + studyLevels().map(function (lv) {
      return '<option' + (lv === (deck ? deck.config.lv : cfg.lv) ? ' selected' : '') + '>' + lv + '</option>';
    }).join('') + '</select></label><label>Deck length<select name="size"' + (deck ? ' disabled' : '') + '>' + [3, 5, 10].map(function (n) {
      return '<option value="' + n + '"' + (n === (deck ? deck.config.size : cfg.size) ? ' selected' : '') + '>' + n + ' cards</option>';
    }).join('') + '</select></label></div><button class="btn primary" type="submit" id="flashcardsStart">' +
    (deck ? 'Continue learning' : 'Start learning') + '</button><p class="explain">Meanings, readings, memory stories and examples appear after you flip. Cards count toward your daily learning goal. Quiz scores and review results only change when you answer a quiz.</p></form>' +
    ((current && current.config.format === 'quiz') || (paused && paused.config.format === 'quiz') ?
      '<section class="card"><h2>Your quiz is safe here</h2><p>Learning with cards keeps your unfinished quiz and answers saved.</p><button class="btn soft" id="flashcardsQuiz">Continue saved quiz</button></section>' : '') + '</div>';
  $('#flashcardsForm', view).addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(this);
    openPracticeFormat(view, deck ? deck.config : Practice.config({ mode: 'explore', kind: data.get('kind'), lv: studyLevel(data.get('lv')), size: data.get('size'), format: 'recall' }, cfg.lv));
  });
  var quiz = $('#flashcardsQuiz', view);
  if (quiz) quiz.addEventListener('click', function () {
    go('#/learn?section=quiz&start=1&format=quiz');
  });
}
function startChallengePractice(view, id, lv) {
  var today = Course.todayStr();
  var quest = Dashboard.challenges(store.study.days, today, store.settings.dailyGoal, lv).find(function (q) { return q.id === id; });
  if (!quest) { go('#/'); return; }
  if (quest.done) {
    view.innerHTML = '<h1>Challenge complete</h1><section class="card"><h2>' + esc(quest.title) + '</h2><p>You’ve completed all ' + quest.target + ' items today.</p><a class="btn primary" href="#/">Back home</a></section>';
    return;
  }
  var current = practiceSession(), paused = practiceSession('pausedSession');
  var saved = [current, paused].find(function (s) { return s && s.config.challenge === id && s.config.challengeDate === today; });
  if (saved) { if (saved === paused) resumePausedPractice(view); else renderPracticePlayer(view, saved); return; }
  var want = Math.min(10, quest.remaining);
  var cfg = { mode: 'explore', kind: quest.kind, lv: lv, size: want <= 3 ? 3 : want <= 5 ? 5 : 10, format: 'recall',
    challenge: id, challengeDate: today, challengeLimit: want };
  var pool = Dashboard.challengeItems(practicePool(cfg), quest, store.study.days[today]);
  if (!pool.length) {
    view.innerHTML = '<h1>' + esc(quest.title) + '</h1><section class="card"><p>You’ve explored every available item for this challenge at ' + esc(lv) + ' today.</p><a class="btn soft" href="#/">Back home</a></section>';
    return;
  }
  var learning = [current, paused].find(function (s) { return s && s.config.format === 'recall' && !s.config.challenge; });
  if (learning) store.practice.returnSession = learning;
  store.practice.pausedSession = [current, paused].find(function (s) { return s && s.config.format === 'quiz'; }) || null;
  store.practice.session = null;
  startPractice(view, cfg);
}
function dailyFlashcardConfig(lv) {
  var batch = store.course ? courseTodaysBatch() : null;
  var remaining = batch ? batch.items.filter(function (item) { return !courseIsLearned(item.type, item.id); }).length :
    Math.max(0, practiceStats().goal - practiceStats().done);
  var want = Math.min(10, remaining || Practice.goal(store.settings.dailyGoal));
  return { mode: 'explore', kind: 'mixed', lv: studyLevel(lv), size: want <= 3 ? 3 : want <= 5 ? 5 : 10,
    format: 'recall', daily: true, dailyLimit: want };
}
function dailyFlashcardPool(cfg) {
  var batch = store.course ? courseTodaysBatch() : null;
  var pending = batch ? batch.items.filter(function (item) { return !courseIsLearned(item.type, item.id); }) : [];
  if (pending.length) return pending.map(function (item) { return Object.assign({ lv: cfg.lv }, item); });
  var practiced = (store.study.days[Course.todayStr()] || {}).practiced || {};
  var pool = practicePool(cfg).filter(function (item) { return !practiced[Practice.key(item)]; });
  var fresh = pool.filter(function (item) { return !courseIsLearned(item.type, item.id); });
  return fresh.length ? fresh : pool;
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
  return '<div class="card"><div class="settings-card-title"><span class="settings-icon sun">' + pengoIcon('check') + '</span><div><h2>Your little daily win</h2><p>A gentle nudge, at your pace.</p></div></div><label for="practiceGoal">Items to practice each day</label> ' +
    '<select id="practiceGoal">' + [3, 5, 10, 20].map(function (n) {
      return '<option value="' + n + '"' + (Practice.goal(store.settings.dailyGoal) === n ? ' selected' : '') + '>' + n + '</option>';
    }).join('') + '</select><p class="explain">Newly studied items and review attempts count. Each item counts once a day, even when you miss it. Learning cards also count. This goal is separate from your plan’s new-material pace.</p></div>';
}
function practicePool(cfg) {
  cfg = Object.assign({}, cfg, { lv: studyLevel(cfg.lv) });
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
  var out = [], levels = cfg.mode === 'due' || cfg.mode === 'mistakes' ? studyLevels() : [cfg.lv];
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
function quizKindLabel(kind) {
  return { mixed: 'All subjects', kanji: 'Kanji', vocab: 'Vocabulary', grammar: 'Grammar' }[kind] || 'Quiz';
}
function recentQuizzesHTML(history) {
  var quizzes = (history || []).filter(function (h) { return h.format !== 'recall'; }).slice(-10).reverse();
  if (!quizzes.length) return '';
  return '<section class="card quiz-history" aria-labelledby="quizHistoryTitle"><div class="practice-heading"><h2 id="quizHistoryTitle">Recent quizzes</h2><span class="explain">Last ' + quizzes.length + '</span></div>' +
    '<ol class="quiz-history-list" tabindex="0" aria-label="Recent quizzes, newest first">' + quizzes.map(function (h) {
      var pct = Math.round(h.score / h.total * 100), radius = 21, circumference = 2 * Math.PI * radius;
      var date = new Date(h.date + 'T12:00:00'), label = Number.isNaN(date.getTime()) ? h.date : date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      return '<li class="quiz-history-item"' + (h.id ? ' data-quiz-id="' + esc(h.id) + '"' : '') + '><svg class="quiz-history-ring" viewBox="0 0 52 52" role="img" aria-label="' + h.score + ' out of ' + h.total + ' correct, ' + pct + ' percent">' +
        '<circle class="quiz-history-track" cx="26" cy="26" r="21"/><circle class="quiz-history-fill" cx="26" cy="26" r="21" stroke-dasharray="' + circumference.toFixed(2) + '" stroke-dashoffset="' + (circumference * (1 - pct / 100)).toFixed(2) + '" transform="rotate(-90 26 26)"/>' +
        '<text x="26" y="30" text-anchor="middle" aria-hidden="true">' + pct + '%</text></svg><strong>' + esc(quizKindLabel(h.kind)) + '</strong><span>' +
        h.score + ' / ' + h.total + (h.lv ? ' · ' + esc(h.lv) : '') + '</span><time datetime="' + esc(h.date) + '">' + esc(label) + '</time></li>';
    }).join('') + '</ol></section>';
}
function renderPractice(view, query, playerView) {
  playerView = playerView || view;
  var cfg = Practice.config(Object.assign({ mode: 'smart', size: 5 }, query, { format: 'quiz' }), (store.course || {}).target || 'N5');
  cfg.lv = studyLevel(cfg.lv);
  var touring = window.OnboardingTour && OnboardingTour.active;
  var current = touring ? null : practiceSession(), paused = touring ? null : practiceSession('pausedSession');
  var saved = current && current.config.format === 'quiz' ? current : paused && paused.config.format === 'quiz' ? paused : null;
  if (query.start === '1' || query.resume === '1') { openPracticeFormat(playerView, cfg); return; }
  function available(mode, kind) {
    var c = Object.assign({}, cfg, { mode: mode, kind: kind }), seen = {};
    return practicePool(c).filter(function (item) {
      var key = Practice.key(item);
      if (seen[key] || (kind !== 'mixed' && item.type !== kind)) return false;
      seen[key] = true;
      return (mode !== 'due' || (practiceSrs(item).inSrs && practiceSrs(item).isDue)) && (mode !== 'mistakes' || !!store.practice.mistakes[key]);
    }).length;
  }
  var due = available('due', cfg.kind), mistakes = available('mistakes', cfg.kind);
  var title = cfg.mode === 'due' ? 'Review due items' : cfg.mode === 'mistakes' ? 'Revisit mistakes' : 'Quiz';
  var kinds = [['mixed', '文', 'mint'], ['kanji', '漢', 'coral'], ['vocab', '語', 'mint'], ['grammar', '文', 'lavender']];
  view.innerHTML = '<section class="card quiz-picker"><div class="practice-heading"><h2 id="learnQuizTitle">' + title + '</h2><span class="explain">' + esc(cfg.lv) + ' · Up to ' + cfg.size + ' questions</span></div>' +
    (saved ? '<div class="quiz-saved"><div class="practice-heading"><strong>' + esc(quizKindLabel(saved.config.kind)) + ' · ' + esc(saved.config.lv) + '</strong><span>' + saved.answers.length + ' / ' + saved.questions.length + '</span></div>' +
      progressBar(Math.round(saved.answers.length / saved.questions.length * 100), 'Saved quiz completion') + '<div class="practice-actions"><button class="btn primary" id="practiceResume">Continue quiz</button>' +
      '<button class="btn soft" id="practiceReplace" aria-expanded="false" aria-controls="quizChoices">Choose a new quiz</button></div></div>' : '') +
    '<div id="quizChoices"' + (saved ? ' hidden' : '') + '><div class="quiz-choices">' + kinds.map(function (kind) {
      var n = available(cfg.mode, kind[0]);
      return '<button class="quiz-choice ' + kind[2] + '" data-quiz-kind="' + kind[0] + '" data-quiz-mode="' + cfg.mode + '"' + (!n ? ' disabled' : '') + '><span class="quiz-choice-icon" lang="ja" aria-hidden="true">' + kind[1] + '</span><strong>' + quizKindLabel(kind[0]) + '</strong></button>';
    }).join('') + '</div>' +
    (cfg.mode === 'due' && !due ? '<p class="explain">No reviews due right now.</p>' : cfg.mode === 'mistakes' && !mistakes ? '<p class="explain">No mistakes to revisit.</p>' : '') +
    (due || mistakes ? '<div class="quiz-review-choices">' +
      (due && cfg.mode !== 'due' ? '<button class="btn soft" data-quiz-mode="due" data-quiz-kind="' + cfg.kind + '">Review due · ' + due + '</button>' : '') +
      (mistakes && cfg.mode !== 'mistakes' ? '<button class="btn soft" data-quiz-mode="mistakes" data-quiz-kind="' + cfg.kind + '">Revisit mistakes · ' + mistakes + '</button>' : '') + '</div>' : '') + '</div></section>' +
    recentQuizzesHTML(store.practice.history);
  $$('[data-quiz-kind]', view).forEach(function (button) {
    button.addEventListener('click', function () {
      if (saved) {
        if (store.practice.session === saved) store.practice.session = null;
        else if (store.practice.pausedSession === saved) store.practice.pausedSession = null;
        save();
      }
      openPracticeFormat(playerView, Practice.config({ mode: button.dataset.quizMode, kind: button.dataset.quizKind, lv: cfg.lv, size: cfg.size, format: 'quiz' }, cfg.lv));
    });
  });
  if (saved) {
    $('#practiceResume', view).addEventListener('click', function () { openPracticeFormat(playerView, saved.config); });
    $('#practiceReplace', view).addEventListener('click', function () {
      var picker = $('#quizChoices', view);
      picker.hidden = !picker.hidden; this.setAttribute('aria-expanded', String(!picker.hidden));
      this.textContent = picker.hidden ? 'Choose a new quiz' : 'Keep saved quiz';
      if (!picker.hidden) { var choice = $('.quiz-choice:not(:disabled)', picker); if (choice) choice.focus({ preventScroll: true }); }
    });
  }
}
function startPractice(view, cfg) {
  cfg = Object.assign({}, cfg, { lv: studyLevel(cfg.lv) });
  var pool = cfg.daily ? dailyFlashcardPool(cfg) : practicePool(cfg);
  var quest = cfg.challenge ? Dashboard.challenges(store.study.days, Course.todayStr(), store.settings.dailyGoal, cfg.lv).find(function (q) { return q.id === cfg.challenge; }) : null;
  var picked = quest ? shuffle(Dashboard.challengeItems(pool, quest, store.study.days[Course.todayStr()])).slice(0, cfg.challengeLimit) :
    Practice.select(pool, cfg, practiceSrs, store.practice.mistakes, courseStateOf);
  if (cfg.daily) picked = picked.slice(0, cfg.dailyLimit);
  var questions = picked.map(function (item) {
    if (cfg.format === 'recall') return Object.assign({}, item, { variant: 0, options: [] });
    var built = courseBuildQuestion(item, item.lv, undefined);
    return built ? { type: item.type, id: item.id, lv: item.lv, variant: built.variant,
      options: built.opts.map(function (r) { return courseQuizKey(built, r); }) } : null;
  }).filter(Boolean);
  if (!questions.length) {
    var msg = cfg.mode === 'due' ? 'You are caught up. Nothing is due for this content right now.' :
      cfg.mode === 'mistakes' ? 'No mistakes waiting for practice. You can try a smart mix when you feel ready.' :
      cfg.daily ? 'You have explored every available item at this level today. Come back tomorrow or browse your lessons.' :
      'No questions available for this selection. Try recall cards or study a few items first.';
    view.innerHTML = '<h1>Daily practice</h1><section class="card"><h2>All clear</h2><p>' + msg +
      '</p><div class="practice-actions"><a class="btn soft" href="#/learn?section=quiz">Choose practice</a><a class="btn soft" href="#/learn">Browse lessons</a></div></section>';
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
  view.innerHTML = '<h1>Review quiz</h1><div class="practice-heading"><p class="explain">' +
    (s.cursor + 1) + ' of ' + total + ' &middot; ' + esc(ref.lv) + ' ' + courseTypeName(q.type) +
    '</p><a href="#/learn?section=quiz" id="practicePause">Pause &amp; save</a></div>' + progressBar(Math.round(s.answers.length / total * 100), "Practice session completion") + pengoPracticeCoachHTML(false) +
    '<div id="practiceBody"><section class="card practice-question">' + '<p class="quiz-q">' + courseQuizPrompt(q) + '</p>' +
    '<div class="quiz-opts">' + q.opts.map(function (o) {
        return '<button class="btn quiz-opt" data-answer="' + esc(courseQuizKey(q, o)) + '"' + (q.variant === 0 || q.variant === 2 && q.type === 'grammar' ? '' : ' lang="ja"') + '>' +
          esc(courseQuizOptionLabel(q, o)) + '</button>';
      }).join('') + '</div>' + '<p id="qFb" class="explain" role="status" aria-live="polite"></p></section></div>';
  var body = $('#practiceBody', view);
  $('#practicePause', view).addEventListener('click', function (e) { e.preventDefault(); save(); go('#/learn?section=quiz'); });
  function grade(ok, selected) {
    if (s.cursor !== cursor || s.answers[s.cursor] || (store.practice.session !== s && !(window.OnboardingTour && OnboardingTour.isPreview(s)))) return;
    s.answers[s.cursor] = { ok: ok, selected: selected };
    if (s.tutorial) { feedback(s.answers[s.cursor]); $('#qFb', body).textContent = 'A practice preview. Your quiz results are unchanged.'; return; }
    courseGrade(q.type, q.id, ok);
    save(); feedback(s.answers[s.cursor]);
    renderNav('learn');
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
    $('#practiceCoachImage',view).src = a.ok ? 'assets/pengo-celebrate.png' : 'assets/pengo-discover.png';
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
function quizResultMessage(score, total) {
  var ratio = total ? score / total : 0;
  if (total && score === total) return { title: 'Every answer right. Amazing work!', text: 'You remembered them all. Enjoy this little win!', mood: 'good', mascot: 'celebrate', alt: 'Pengo celebrating a perfect quiz' };
  if (ratio >= .8) return { title: 'Look at that progress!', text: 'You remembered most of these. A little review will help the rest stick.', mood: 'good', mascot: 'celebrate', alt: 'Pengo celebrating your progress' };
  if (ratio >= .5) return { title: 'You’re getting there!', text: 'You’ve got a good start. Revisit the tricky ones and build on it.', mood: 'study', mascot: 'happy', alt: 'Pengo cheering you on' };
  return { title: 'Every try helps you learn.', text: 'These words and ideas take practice. Try a few missed items at your own pace. Pengo is with you!', mood: 'encouragement', mascot: 'discover', alt: 'Pengo holding a book, ready to keep learning with you' };
}
function finishPractice(view, s) {
  if (s.tutorial) return;
  var score = s.answers.filter(function (a) { return a.ok; }).length;
  var missed = s.questions.filter(function (q, i) { return !s.answers[i].ok; });
  var fresh = store.practice.badges.filter(function (b) { return !(s.startingBadges || []).includes(b); });
  if (!store.practice.history.some(function (h) { return h.id === s.id; })) {
    store.practice.history.push({ id: s.id, date: Course.todayStr(), score: score, total: s.questions.length,
      format: s.config.format, mode: s.config.mode, kind: s.config.kind, lv: s.config.lv, completedAt: Date.now() });
    store.practice.history = Practice.normalize({ history: store.practice.history }).history;
    if (s.config.format === 'quiz' && s.config.mode === 'plan' && store.course && store.course.target === s.config.lv) {
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
  store.practice.session = s.config.challenge ? practiceSession('returnSession') : null;
  if (s.config.challenge) store.practice.returnSession = null;
  save(); renderNav('learn');
  var stats = practiceStats();
  if (s.config.format === 'recall') {
    var challenge = s.config.challenge ? Dashboard.challenges(store.study.days, Course.todayStr(), store.settings.dailyGoal, s.config.lv).find(function (q) { return q.id === s.config.challenge; }) : null;
    view.innerHTML = '<h1>Learning complete</h1><section class="card quiz-result good">' + pengoCelebrationHTML() +
      '<h2>A few new discoveries to take with you</h2><p>' + s.questions.length + ' cards explored · ' + score + ' marked “Got it”.</p>' +
      '<p class="explain">Learning confidence is separate from quiz results. Check what you remember with a quiz when you feel ready.</p>' +
      '<p>' + stats.done + ' / ' + stats.goal + ' items toward your daily goal.</p>' +
      (challenge ? '<p>' + esc(challenge.title) + ' · ' + Math.min(challenge.count, challenge.target) + ' / ' + challenge.target + (challenge.done ? ' complete' : ' items') + '</p>' : '') +
      '<div class="practice-actions"><button class="btn primary" id="recallContinue">' + (challenge && !challenge.done ? 'Continue challenge' : 'Keep learning') + '</button><a class="btn soft" href="#/today">Today’s items</a><a class="btn soft" href="#/learn?section=quiz">Try a quiz</a><a class="btn soft" href="#/">Done for now</a></div></section>' +
      (missed.length ? '<section class="card"><h2>Keep exploring</h2><p class="explain">You marked these “Still learning”. Revisit their details whenever you like.</p>' +
        missed.map(function (q) { return courseItemRow(q.type, q.id, false); }).join('') + '</section>' : '');
    $('#recallContinue', view).addEventListener('click', function () {
      renderFlashcards(view, challenge && !challenge.done ? { challenge: challenge.id, lv: s.config.lv } : { daily: '1', lv: s.config.lv });
    });
    view.focus({preventScroll:true}); window.scrollTo(0,0); return;
  }
  var bestMap = s.config.kind === 'kanji' ? store.quizBest : s.config.kind === 'vocab' ? store.vQuizBest : store.gQuizBest;
  var bestText = s.config.format === 'quiz' && s.config.kind !== 'mixed' && s.questions.length === 10 && s.questions.every(function (q) { return q.lv === s.config.lv; })
    ? '<p class="explain">Best on ' + esc(s.config.lv) + ': ' + bestMap[s.config.lv] + ' / 10</p>' : '';
  var result = quizResultMessage(score, s.questions.length);
  view.innerHTML = '<h1>Session complete</h1><section class="card quiz-result ' + result.mood + '">' + (result.mood === 'good' ? pengoCelebrationHTML() : '') + '<img class="quiz-result-img" src="assets/pengo-' + result.mascot + '.png" alt="' + esc(result.alt) + '">' +
    '<h2>' + esc(result.title) + '</h2><p>' + esc(result.text) + '</p><div class="result-stats"><div><strong>' + s.questions.length + '</strong><span>attempts made</span></div><div><strong>' + score + ' / ' + s.questions.length + '</strong><span>correct</span></div><div><strong>' + stats.streak + '</strong><span>day streak</span></div></div><p class="explain">' +
    score + ' correct' +
    ', ' + missed.length + ' to keep practicing.</p>' + bestText + '<p>' + stats.done + ' / ' + stats.goal + ' items practiced today.</p>' +
    '<p class="explain">' + (stats.goalMet ? 'Daily goal complete. This is a good place to stop.' : 'A small session is still progress. Come back when it fits your day.') + '</p>' +
    (fresh.length ? '<p>New achievement: ' + fresh.map(function (id) { return esc(Practice.BADGES.find(function (b) { return b.id === id; }).label); }).join(', ') + '</p>' : '') +
    '<div class="practice-actions"><a class="btn primary" href="#/">Done for now</a>' +
    (missed.length ? '<a class="btn soft" href="#/learn?section=quiz&mode=mistakes">Practice mistakes</a>' : '<a class="btn soft" href="#/learn?section=quiz">Choose another session</a>') + '</div></section>' +
    (missed.length ? '<section class="card"><h2>What to revisit</h2><p class="explain">These items are saved in Mistakes. Answering them correctly in a quiz clears that list.</p>' +
      missed.map(function (q) { return courseItemRow(q.type, q.id, false); }).join('') + '</section>' : '');
  view.focus({ preventScroll: true }); window.scrollTo(0, 0);
}
