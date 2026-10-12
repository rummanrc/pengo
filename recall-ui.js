"use strict";
/* A finite, resumable card deck. Learning confidence stays separate from graded quiz results. */
function recallDetailsHTML(q) { return quizReviewHTML(q.type, q.head); }
function renderRecallPlayer(view, s) {
  if (s.cursor >= s.questions.length) { finishPractice(view, s); return; }
  var cursor = s.cursor, ref = s.questions[cursor], q = practiceHydrate(ref), item = q.head;
  var face = q.type === 'kanji' ? item.k : q.type === 'vocab' ? item.word : item.point;
  var readings = q.type === 'kanji' ?
    (item.on.length ? '<span class="recall-reading-line"><span class="lab" lang="ja">音読み（おんよみ） </span><span lang="ja">' + esc(item.on.join('、 ')) + '</span></span>' : '') +
    (item.kun.length ? '<span class="recall-reading-line"><span class="lab" lang="ja">訓読み（くんよみ） </span><span lang="ja">' + esc(item.kun.join('、 ')) + '</span></span>' : '') :
    (item.reading ? '<span class="recall-reading-line" lang="ja">' + esc(item.reading) + '</span>' : '');
  var answer = s.answers[cursor], revealed = false;
  view.innerHTML = '<div class="recall-deck" aria-label="Learning cards"><div class="recall-counter"><span>' + (cursor + 1) + ' / ' + s.questions.length + ' cards</span>' +
    '<a class="btn soft" id="practicePause" href="#/flashcards?choose=1">Pause &amp; save</a></div>' +
    progressBar(Math.round(s.answers.length / s.questions.length * 100), 'Card deck completion') +
    '<div class="recall-stage" id="recallStage"><div class="recall-flipper" id="recallFlipper">' +
    '<button class="recall-face recall-front" id="practiceReveal" aria-label="Reveal answer" aria-expanded="false" aria-controls="recallBack recallDetails practiceRatings">' +
    '<span class="badge ' + levelClass(ref.lv) + '">' + esc(ref.lv) + ' · ' + courseTypeName(q.type) + '</span><span class="recall-glyph' + (q.type === 'kanji' ? ' recall-glyph-kanji' : '') + '" lang="ja">' + esc(face) + '</span>' +
    '<span class="recall-tap">' + pengoIcon('refresh') + ' Tap to reveal</span></button>' +
    '<button type="button" class="recall-face recall-back" id="recallBack" aria-label="Flip back to front" aria-hidden="true" inert>' +
    '<span class="recall-back-glyph" lang="ja">' + esc(face) + '</span><span class="recall-meaning"><span class="eyebrow">Meaning</span><strong>' + esc(item.meaning) + '</strong></span><span class="recall-readings">' + readings + '</span>' +
    '<span class="recall-tap">' + pengoIcon('refresh') + ' Tap to flip back</span></button></div></div>' +
    '<div class="recall-dock"><div id="practiceRatings" hidden><p>How does it feel now?</p><div class="practice-actions">' +
    '<button class="btn soft" id="practiceAgain">Still learning</button><button class="btn primary" id="practiceRemembered">Got it</button></div></div>' +
    '<p id="qFb" class="explain" role="status" aria-live="polite"></p><button class="btn primary" id="practiceNext" hidden>' +
    (cursor + 1 === s.questions.length ? 'Finish session' : 'Next card →') + '</button><p class="explain" id="recallSwipe" hidden>Swipe left on the card or press → to continue.</p></div>' +
    '<div id="recallDetails" hidden>' + recallDetailsHTML(q) + '<p><a class="btn soft" href="' + courseItemLink(q.type, q.id) + '">Explore full details</a></p></div></div>';
  var stage = $('#recallStage', view), front = $('#practiceReveal', view), back = $('#recallBack', view);
  var next = $('#practiceNext', view), ratings = $('#practiceRatings', view);
  function current() { return (store.practice.session === s || window.OnboardingTour && OnboardingTour.isPreview(s)) && s.cursor === cursor && view.contains(stage); }
  function flip(show, focus) {
    if (!current()) return;
    revealed = show; s.revealedCursor = show ? cursor : null; if (!s.tutorial) save();
    $('#recallFlipper', view).classList.toggle('is-flipped', show);
    front.setAttribute('aria-expanded', show);
    front.setAttribute('aria-hidden', show); front.inert = show;
    back.setAttribute('aria-hidden', !show); back.inert = !show;
    $('#recallDetails', view).hidden = !show;
    ratings.hidden = !show || !!answer;
    if (focus) (show ? answer ? next : $('#practiceRemembered', view) : front).focus({ preventScroll: true });
  }
  function feedback() {
    ratings.hidden = true; next.hidden = false;
    $('#recallSwipe', view).hidden = cursor + 1 === s.questions.length;
    $('#qFb', view).textContent = answer.ok ? 'Got it. Added to your studied items; try a quiz when you’re ready.' : 'Keep exploring. This is learning, so there’s no wrong answer.';
    stage.classList.add(answer.ok ? 'recall-remembered' : 'recall-learning');
  }
  function grade(ok, selected) {
    if (!current() || !revealed || s.answers[cursor]) return;
    answer = { ok: ok, selected: selected }; s.answers[cursor] = answer;
    if (s.tutorial) {
      ratings.hidden = true;
      $('#qFb', view).textContent = 'Nice! In your own deck, this moves you to the next card.';
      return;
    }
    if (ok) courseMarkStudied(q.type, q.id);
    var day = studyDay(Course.todayStr());
    day.recalled = day.recalled || {}; day.recalled[Practice.key(ref)] = true;
    day.practiced = day.practiced || {}; day.practiced[Practice.key(ref)] = true;
    courseRecordDay(); updatePracticeBadges(); Reminders.syncGoal();
    save(); renderNav('learn');
    if (ok) { advance(); return; }
    feedback(); next.focus({ preventScroll: true });
  }
  function advance() {
    if (!current() || !s.answers[cursor]) return;
    s.cursor++; s.revealedCursor = null; save(); renderPracticePlayer(view, s);
    view.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  front.addEventListener('click', function () { flip(true, true); });
  back.addEventListener('click', function () { flip(false, true); });
  $('#practiceAgain', view).addEventListener('click', function () { grade(false, 'again'); });
  $('#practiceRemembered', view).addEventListener('click', function () { grade(true, 'remembered'); });
  next.addEventListener('click', advance);
  $('#practicePause', view).addEventListener('click', function (e) { e.preventDefault(); save(); go('#/flashcards?choose=1'); });
  var start = null;
  stage.addEventListener('pointerdown', function (e) {
    if (e.isPrimary && e.button === 0) start = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointercancel', function () { start = null; });
  stage.addEventListener('pointerup', function (e) {
    if (!start) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
    if (dx < -65 && Math.abs(dx) > Math.abs(dy) * 1.5) advance();
  });
  $('.recall-deck', view).addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select') && s.answers[cursor]) { e.preventDefault(); advance(); }
  });
  // Related detail links carry the same deck context, including component links.
  $$('a[href]', $('#recallDetails', view)).forEach(function (link) {
    if (!/^#\/(k|v|g)\//.test(link.getAttribute('href'))) return;
    link.href += '?deck=' + encodeURIComponent(s.id);
    link.addEventListener('click', function () {
      history.replaceState(history.state, '', '#/flashcards?resume=1&deck=' + encodeURIComponent(s.id));
    });
  });
  if (answer || s.revealedCursor === cursor) flip(true, false);
  if (answer) feedback();
}
