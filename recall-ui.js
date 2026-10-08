"use strict";
/* A finite, resumable card deck. Reveal never grades; explicit recall ratings do. */
function recallDetailsHTML(q) {
  var item = q.head;
  if (q.type === 'kanji') {
    var example = (item.vocab || [])[0], sentence = (item.sentences || []).find(function (s) { return s.jp && s.en && /[A-Za-z]/.test(s.en) && !/\(#\d|#\d/.test(s.en); });
    return '<section class="card recall-story"><span class="eyebrow">MAKE IT STICK</span><h2>A little memory story</h2><p class="mnemonic">' +
      esc(mnemonicFor(item).text) + '</p><p class="explain">Memory aid, not etymology.</p></section>' +
      '<section class="card"><h2>Find the shapes</h2>' + componentsHTML(item) + '</section>' +
      (example ? '<section class="card"><h2>Take it into a word</h2><p class="jp" lang="ja">' + esc(example.w) +
        '</p><p lang="ja">' + esc(example.r) + '</p><p>' + esc(example.m) + '</p>' +
        (sentence ? '<p lang="ja">' + esc(sentence.jp) + '</p><p class="explain">' + esc(sentence.en) + '</p>' : '') + '</section>' : '');
  }
  return quizReviewHTML(q.type, item);
}
function renderRecallPlayer(view, s) {
  if (s.cursor >= s.questions.length) { finishPractice(view, s); return; }
  var cursor = s.cursor, ref = s.questions[cursor], q = practiceHydrate(ref), item = q.head;
  var face = q.type === 'kanji' ? item.k : q.type === 'vocab' ? item.word : item.point;
  var readings = q.type === 'kanji' ?
    (item.on.length ? '<p><span class="lab">On </span><span lang="ja">' + esc(item.on.join('、 ')) + '</span></p>' : '') +
    (item.kun.length ? '<p><span class="lab">Kun </span><span lang="ja">' + esc(item.kun.join('、 ')) + '</span></p>' : '') :
    (item.reading ? '<p lang="ja">' + esc(item.reading) + '</p>' : '');
  var answer = s.answers[cursor], revealed = false;
  view.innerHTML = '<div class="recall-deck"><div class="practice-heading"><div><span class="eyebrow">GUESS · FLIP · DISCOVER</span><h1>Today’s discovery cards</h1></div>' +
    '<a id="practicePause" href="#/practice">Pause &amp; save</a></div>' +
    '<div class="recall-counter"><span>' + (cursor + 1) + ' / ' + s.questions.length + ' cards</span><span class="badge ' + levelClass(ref.lv) + '">' +
    esc(ref.lv) + ' · ' + courseTypeName(q.type) + '</span></div>' + progressBar(Math.round(s.answers.length / s.questions.length * 100), 'Card deck completion') +
    '<p class="explain recall-instruction">Make a guess. Tap the card to find the story behind the shape.</p>' +
    '<div class="recall-stage" id="recallStage"><div class="recall-flipper" id="recallFlipper">' +
    '<button class="recall-face recall-front" id="practiceReveal" aria-label="Reveal answer" aria-expanded="false" aria-controls="recallBack recallDetails practiceRatings">' +
    '<span class="eyebrow">WHAT DOES IT MEAN?</span><span class="recall-glyph' + (q.type === 'kanji' ? ' recall-glyph-kanji' : '') + '" lang="ja">' + esc(face) + '</span>' +
    '<span class="recall-tap">' + pengoIcon('refresh') + ' Tap to reveal</span></button>' +
    '<div class="recall-face recall-back" id="recallBack" aria-hidden="true" inert><span class="eyebrow">YOUR DISCOVERY</span>' +
    '<span class="recall-back-glyph" lang="ja">' + esc(face) + '</span><h2>' + esc(item.meaning) + '</h2><div class="recall-readings">' + readings + '</div>' +
    '<button class="btn soft" id="recallHide">Show the front again</button></div></div></div>' +
    '<div class="recall-dock"><div id="practiceRatings" hidden><p>How did your guess go?</p><div class="practice-actions">' +
    '<button class="btn soft" id="practiceAgain">Need practice</button><button class="btn primary" id="practiceRemembered">Remembered</button></div></div>' +
    '<p id="qFb" class="explain" role="status" aria-live="polite"></p><button class="btn primary" id="practiceNext" hidden>' +
    (cursor + 1 === s.questions.length ? 'Finish session' : 'Next card →') + '</button><p class="explain" id="recallSwipe" hidden>Swipe left on the card or press → to continue.</p></div>' +
    '<div id="recallDetails" hidden>' + recallDetailsHTML(q) + '<p><a class="btn soft" href="' + courseItemLink(q.type, q.id) + '">Explore full details</a></p></div></div>';
  var stage = $('#recallStage', view), front = $('#practiceReveal', view), back = $('#recallBack', view);
  var next = $('#practiceNext', view), ratings = $('#practiceRatings', view);
  function current() { return store.practice.session === s && s.cursor === cursor && view.contains(stage); }
  function flip(show, focus) {
    if (!current()) return;
    revealed = show;
    $('#recallFlipper', view).classList.toggle('is-flipped', show);
    front.setAttribute('aria-expanded', show);
    front.setAttribute('aria-hidden', show); front.inert = show;
    back.setAttribute('aria-hidden', !show); back.inert = !show;
    $('#recallDetails', view).hidden = !show;
    ratings.hidden = !show || !!answer;
    if (focus) (show ? answer ? next : $('#practiceAgain', view) : front).focus({ preventScroll: true });
  }
  function feedback() {
    ratings.hidden = true; next.hidden = false;
    $('#recallSwipe', view).hidden = cursor + 1 === s.questions.length;
    $('#qFb', view).textContent = answer.ok ? 'Remembered. Your review schedule is updated.' : 'A useful discovery. We’ll bring this back for review.';
    stage.classList.add(answer.ok ? 'recall-remembered' : 'recall-learning');
  }
  function grade(ok, selected) {
    if (!current() || !revealed || s.answers[cursor]) return;
    answer = { ok: ok, selected: selected }; s.answers[cursor] = answer;
    courseGrade(q.type, q.id, ok);
    var day = studyDay(Course.todayStr());
    day.recalled = day.recalled || {}; day.recalled[Practice.key(ref)] = true;
    save(); renderNav('review'); feedback(); next.focus({ preventScroll: true });
  }
  function advance() {
    if (!current() || !s.answers[cursor]) return;
    s.cursor++; save(); renderPracticePlayer(view, s);
    view.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  front.addEventListener('click', function () { flip(true, true); });
  $('#recallHide', view).addEventListener('click', function () { flip(false, true); });
  $('#practiceAgain', view).addEventListener('click', function () { grade(false, 'again'); });
  $('#practiceRemembered', view).addEventListener('click', function () { grade(true, 'remembered'); });
  next.addEventListener('click', advance);
  $('#practicePause', view).addEventListener('click', function (e) { e.preventDefault(); save(); go('#/practice'); });
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
  if (answer) { flip(true, false); feedback(); }
}
