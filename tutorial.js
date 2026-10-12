"use strict";
/* Guided taps on the real interface. Preview cards/quizzes never enter saved practice state. */
var OnboardingTour = (function () {
  var root, panel, ring, shades, spacer, target, stepIndex = 0, frame = null, retry = null, entering = false;
  var originalDescription = null, returnHash = '#/', replay = false, moving = false;
  var api = { active: false, previewSession: null };
  function nav(path) { return '#bottomNav a[href="' + path + '"], #sideNav a[href="' + path + '"]'; }
  var steps = [
    { page: 'home', selector: '.hero-start', title: 'Start with a little discovery', text: 'Tap Start learning to open your flashcards. If you have a saved deck, this button says Continue learning.' },
    { page: 'flashcards', selector: '#practiceReveal', title: 'Think, then flip', text: 'Try guessing the meaning, then tap the card to reveal it.' },
    { page: 'flashcards', selector: '#practiceRemembered', title: 'Choose how it feels', text: 'Got it moves you ahead; Still learning gives you another look. Tap Got it to try it. This preview won’t mark anything as learned.' },
    { page: 'flashcards', selector: nav('#/'), title: 'Come back to your day', text: 'Tap Home to find today’s word and your daily steps.' },
    { page: 'home', selector: '#dailyWordReveal', title: 'A word waiting for you', text: 'Tap Today’s word to reveal a small discovery. There’s a new one each day.' },
    { page: 'home', selector: '#dailyWordContent', title: 'Your daily discovery', text: 'Here are the word, its reading, and its meaning. Explore word opens more examples whenever you want.', info: true },
    { page: 'home', selector: '.today-overview a[href="#/today"]', title: 'Your day, in little steps', text: 'This card counts the different kanji, words, and grammar you study or practice today. Tap View items to see the list.' },
    { page: 'today', selector: nav('#/'), title: 'Your learning, gathered here', text: 'Today’s items keeps your discoveries together. Tap Home to see your daily challenges.' },
    { page: 'home', selector: '.challenge-list a, .daily-challenges', title: 'Little goals to aim for', text: 'Daily challenges give you small goals: practice a few items, focus on one subject, or flip a few kanji. Tap a challenge to preview its cards.' },
    { selector: nav('#/learn'), title: 'Quizzes live in Learn', text: 'Challenges open a focused flashcard deck. Whenever you want to check what you remember, tap Learn.' },
    { page: 'learn', selector: '.quiz-choice[data-quiz-kind="mixed"]', title: 'A quiz whenever you’re ready', text: 'Choose All subjects, Kanji, Vocabulary, or Grammar for a short quiz. Tap All subjects to try a preview.' },
    { page: 'learn', selector: '.practice-question', action: '[data-answer]', title: 'Give an answer a try', text: 'Tap an answer. You’ll see the correct choice and a quick recap. This preview won’t change your quiz scores.' },
    { page: 'learn', selector: nav('#/progress'), title: 'Watch your progress grow', text: 'Tap Progress to see what you’ve learned, your practice goal, and your study activity.' },
    { page: 'progress', selector: '.pg-hero', title: 'You’re ready to explore', text: 'Your progress grows as you study. Come back here for your subject totals, activity, and achievements. You can replay this tour from Settings anytime.', info: true }
  ];
  function visible(selector) {
    return selector.split(',').flatMap(function (part) { return Array.from(document.querySelectorAll(part.trim())); }).find(function (el) {
      return el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
    });
  }
  function detachTarget() {
    if (!target) return;
    target.classList.remove('tour-target');
    if (originalDescription === null) target.removeAttribute('aria-describedby');
    else target.setAttribute('aria-describedby', originalDescription);
    target = null;
  }
  function describe(el) {
    detachTarget(); target = el;
    originalDescription = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', ((originalDescription || '') + ' tourText').trim());
    target.classList.add('tour-target');
  }
  function setRect(el, left, top, width, height) {
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: Math.max(0, width) + 'px', height: Math.max(0, height) + 'px' });
  }
  function position(scroll) {
    if (!api.active || !target) return;
    var width = window.innerWidth, height = window.innerHeight;
    var bottomNav = visible('#bottomNav'), topBar = visible('.topbar');
    var bottom = bottomNav ? bottomNav.getBoundingClientRect().height : 12;
    var top = topBar ? topBar.getBoundingClientRect().bottom + 8 : 12;
    var sideGuide = width >= 650 && height <= 550;
    panel.style.width = Math.min(350, width - 24) + 'px';
    var ph = panel.getBoundingClientRect().height;
    spacer.style.height = (sideGuide ? 32 : ph + bottom + 32) + 'px';
    var navigation = !!target.closest('#bottomNav, #sideNav');
    if (scroll && !navigation) {
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      var initial = target.getBoundingClientRect();
      // Leave room for the guide below the highlighted control.
      window.scrollBy(0, (initial.top + initial.bottom) / 2 - (top + Math.max(44, height - bottom - (sideGuide ? 0 : ph) - top - 24) / 2));
    }
    var r = target.getBoundingClientRect();
    var panelTop = sideGuide ? Math.max(top, (height - bottom - ph + top) / 2) : Math.max(top, height - bottom - ph - 12);
    // Sidebar and bottom-nav links stay in place; keep the guide clear of them.
    if (!sideGuide && navigation && r.top < panelTop + ph && r.bottom > panelTop) panelTop = Math.max(top, r.top - ph - 16);
    if (!sideGuide && !navigation && r.bottom + 10 > panelTop && r.top - ph - 16 >= top) panelTop = r.top - ph - 16;
    panel.style.left = (sideGuide ? width - panel.offsetWidth - 12 : Math.max(12, Math.min(width - panel.offsetWidth - 12, r.left + r.width / 2 - panel.offsetWidth / 2))) + 'px';
    panel.style.top = panelTop + 'px';
    var left = Math.max(4, r.left - 5), right = Math.min(width - 4, r.right + 5);
    var upper = Math.max(navigation ? 4 : top, r.top - 5), lower = Math.min(height - (navigation ? 4 : bottom), r.bottom + 5);
    if (!sideGuide && !navigation && r.top < panelTop) lower = Math.min(lower, panelTop - 10);
    else if (!sideGuide && !navigation) upper = Math.max(upper, panelTop + ph + 10);
    setRect(ring, left, upper, right - left, lower - upper);
    setRect(shades[0], 0, 0, width, upper);
    setRect(shades[1], 0, lower, width, height - lower);
    setRect(shades[2], 0, upper, left, lower - upper);
    setRect(shades[3], right, upper, width - right, lower - upper);
  }
  function draw() {
    var step = steps[stepIndex], last = stepIndex === steps.length - 1;
    var completedChallenges = stepIndex === 8 && target && target.classList.contains('daily-challenges');
    panel.innerHTML = '<div class="tour-heading"><span class="eyebrow">PENGO’S GUIDED TOUR · ' + (stepIndex + 1) + ' / ' + steps.length +
      '</span><button type="button" class="tour-skip">Skip tour</button></div><h2 id="tourTitle">' + esc(step.title) +
      '</h2><p id="tourText">' + esc(completedChallenges ? 'You’ve finished today’s challenges! On a new day, tap an unfinished challenge to open a focused deck of cards.' : step.text) +
      '</p>' + (last || step.info || completedChallenges ? '<button type="button" class="btn primary tour-next">' + (last ? 'Finish tour' : 'Next') + '</button>' : '<p class="tour-instruction">Tap the highlighted item to continue.</p>');
    panel.querySelector('.tour-skip').addEventListener('click', function () { finish(true); });
    var next = panel.querySelector('.tour-next');
    if (next) next.addEventListener('click', advance);
    position(entering); entering = false;
    // Announce each instruction and put keyboard users on the actual control.
    var control = step.info || completedChallenges ? next : step.action ? target.querySelector(step.action) : target;
    if (control && control.matches('a,button,input,[tabindex]')) control.focus({ preventScroll: true });
    else panel.focus({ preventScroll: true });
  }
  function sync() {
    frame = null;
    if (!api.active) return;
    var found = visible(steps[stepIndex].selector);
    if (!found) {
      // Route changes replace the view asynchronously. Keep the whole screen
      // covered until the next real target exists, so stray taps cannot grade.
      ring.hidden = true;
      setRect(shades[0], 0, 0, innerWidth, innerHeight);
      shades.slice(1).forEach(function (shade) { setRect(shade, 0, 0, 0, 0); });
      clearTimeout(retry); retry = setTimeout(api.refresh, 80); return;
    }
    ring.hidden = false;
    if (target !== found || entering) { describe(found); draw(); }
    else position(false);
  }
  api.refresh = function () {
    if (!api.active || frame !== null) return;
    frame = requestAnimationFrame(sync);
  };
  function advance() {
    if (!api.active || moving) return;
    if (stepIndex === steps.length - 1) { finish(false); return; }
    moving = true;
    // Let the real click handler finish (flip/reveal/navigation) first.
    setTimeout(function () {
      if (!api.active) return;
      moving = false; detachTarget(); stepIndex++; entering = true;
      api.refresh();
    }, 0);
  }
  function click(event) {
    if (!api.active || root.contains(event.target)) return;
    var step = steps[stepIndex];
    var allowed = target && target.contains(event.target) && !step.info &&
      !(stepIndex === 8 && target.classList.contains('daily-challenges')) &&
      (!step.action || event.target.closest(step.action));
    if (!allowed || moving) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    var link = event.target.closest('a[href^="#/"]');
    if (link) {
      event.preventDefault();
      var hash = link.getAttribute('href');
      history.replaceState(history.state, '', hash + (hash.includes('?') ? '&' : '?') + 'introTour=1'); render();
    }
    advance();
  }
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); finish(true); return; }
    if (event.key !== 'Tab') return;
    var step = steps[stepIndex], candidates = [];
    if (target && !step.info) {
      candidates = step.action ? Array.from(target.querySelectorAll(step.action)) : target.matches('a,button,[tabindex]') ? [target] : [];
    }
    candidates = candidates.concat(Array.from(panel.querySelectorAll('button'))).filter(function (el) { return !el.disabled && el.getClientRects().length; });
    if (!candidates.length) return;
    var current = candidates.indexOf(document.activeElement), index = (current + (event.shiftKey ? -1 : 1) + candidates.length) % candidates.length;
    if (current === -1) index = event.shiftKey ? candidates.length - 1 : 0;
    event.preventDefault(); candidates[index].focus({ preventScroll: true });
  }
  function finish(skipped) {
    if (!api.active) return;
    api.active = false; api.previewSession = null; moving = false;
    clearTimeout(retry); cancelAnimationFrame(frame); frame = null;
    detachTarget(); root.remove(); spacer.remove(); document.body.classList.remove('tour-open');
    document.removeEventListener('click', click, true); document.removeEventListener('keydown', keydown, true);
    window.removeEventListener('resize', api.refresh); window.removeEventListener('scroll', api.refresh, true);
    window.OBBack = null; markOnboarded();
    studyTimeTick = Date.now();
    // Replace tutorial history, so Back cannot reopen a discarded preview.
    var destination = replay ? returnHash : !skipped && !store.course ? '#/course/setup' : '#/';
    history.replaceState(history.state, '', destination); render();
  }
  api.start = function (options) {
    if (api.active || !DB.loaded) return;
    replay = !!(options && options.replay); returnHash = location.hash || '#/';
    stepIndex = 0; entering = true; moving = false; api.active = true;
    studyTimeTick = Date.now();
    api.previewSession = null;
    root = document.createElement('div'); root.className = 'tour-root';
    root.setAttribute('aria-label', 'Pengo guided tour');
    root.innerHTML = '<div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-ring" aria-hidden="true"></div><section class="tour-panel" role="dialog" aria-labelledby="tourTitle" aria-describedby="tourText" tabindex="-1"></section>';
    shades = Array.from(root.querySelectorAll('.tour-shade')); panel = root.querySelector('.tour-panel'); ring = root.querySelector('.tour-ring');
    document.body.appendChild(root); document.body.classList.add('tour-open');
    spacer = document.createElement('div'); spacer.className = 'tour-space'; spacer.setAttribute('aria-hidden', 'true');
    document.querySelector('.main-col').appendChild(spacer);
    document.documentElement.classList.remove('ob-boot');
    document.addEventListener('click', click, true); document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', api.refresh); window.addEventListener('scroll', api.refresh, true);
    window.OBBack = function () { finish(true); return true; };
    history.replaceState(history.state, '', '#/?introTour=1'); render();
  };
  api.isPreview = function (session) { return api.active && session === api.previewSession && session.tutorial === true; };
  api.showPreview = function (view, cfg) {
    var lv = studyLevel(cfg.lv), format = cfg.format || 'quiz';
    var kind = ['kanji', 'grammar'].includes(cfg.kind) ? cfg.kind : 'vocab';
    var previewKey = format + ':' + lv + ':' + kind + ':' + (cfg.source || 'quiz');
    var session = api.previewSession;
    if (!session || session.previewKey !== previewKey) {
      var row = ((kind === 'kanji' ? DB.levels : kind === 'grammar' ? DB.grammar : DB.vocab)[lv] || [])[0];
      if (!row) { finish(true); return; }
      var item = { type: kind, id: kind === 'kanji' ? row.k : row.id, lv: lv };
      var built = format === 'quiz' ? courseBuildQuestion(item, lv, 0) : null;
      var question = Object.assign({}, item, { variant: built ? built.variant : 0, options: built ? built.opts.map(function (r) { return courseQuizKey(built, r); }) : [] });
      session = api.previewSession = { tutorial: true, previewKey: previewKey, id: 'intro-preview', config: { format: format, kind: kind, lv: lv }, cursor: 0, questions: [question], answers: [] };
    }
    renderPracticePlayer(view, session);
    view.insertAdjacentHTML('afterbegin', '<p class="tour-preview-label">Guided tour · Practice preview</p>');
    api.refresh();
  };
  return api;
})();
window.OnboardingTour = OnboardingTour;
