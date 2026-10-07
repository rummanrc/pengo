"use strict";
/* Pengo's visual identity: original illustrations, real progress, and gentle motion. */
function pengoIcon(name) {
  var paths = {
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    fire: '<path d="M13 3c1 5-5 5-3 9 1-2 3-2 4-4 5 4 6 7 3 10-3 4-10 3-11-2-1-4 3-8 7-13Z"/>',
    book: '<path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 3-2-3-5-4-9-3Z"/>',
    bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4M12 2v2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    flag: '<path d="M5 21V3m0 1c6-3 8 3 14 0v10c-6 3-8-3-14 0"/>',
    mountain: '<path d="m2 20 7-12 4 6 3-10 6 16Zm13-9 2 2 2-2"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8M9 18h6"/>',
    refresh: '<path d="M20 8V3l-4 4M4 16v5l4-4M4 10a8 8 0 0 1 14-5m2 9a8 8 0 0 1-14 5"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" class="pengo-symbol" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.spark) + '</svg>';
}
function pengoHeroHTML(hasPlan) {
  var stats = practiceStats(), session = practiceSession();
  var title = stats.goalMet ? 'Look at you go!' : stats.breakDays >= 2 ? 'Your next chapter starts here.' : hasPlan ? 'Small steps. Big adventures.' : 'Japanese is an adventure.';
  var subtitle = stats.goalMet ? 'Today’s goal is in the bag. Pengo is proud of you.' : hasPlan ? 'A few words today. A little more confidence tomorrow.' : 'Meet Pengo, your study buddy. Let’s make a little progress together.';
  var href = session ? '#/practice?resume=1' : stats.goalMet ? '#/progress' : '#/practice?start=1&size=3';
  return '<section class="adventure-hero"><div class="hero-copy"><span class="eyebrow">' + (hasPlan ? esc(courseGreeting()) : 'HELLO, FUTURE YOU') + '</span>' +
    '<h1>' + title + '</h1><p>' + subtitle + '</p><a class="btn primary hero-start" href="' + href + '">' +
    (session ? 'Continue your session' : stats.goalMet ? 'Celebrate your progress' : 'Let’s practice') + pengoIcon('arrow') + '</a>' +
    '<span class="hero-footnote">' + (session ? 'Pick up right where you left off' : stats.goalMet ? 'You’ve earned a breather' : 'Just 3 questions to get going') + '</span></div>' +
    '<div class="hero-art"><span class="hero-orbit orbit-one" aria-hidden="true">あ</span><span class="hero-orbit orbit-two" aria-hidden="true">' + pengoIcon('spark') + '</span>' +
    '<img class="hero-pengo" src="assets/pengo-adventure.png" width="250" height="270" alt="Pengo waving, ready for your next learning adventure">' +
    '<button class="pengo-tip" data-pengo-tip aria-label="Ask Pengo for a study tip">Pengo’s tip ' + pengoIcon('spark') + '</button>' +
    '<p class="pengo-bubble" data-pengo-bubble role="status" aria-live="polite" hidden></p></div></section>';
}
function dailyPracticeCardHTML() {
  var stats = practiceStats(), pct = Math.min(100, Math.round(stats.done / stats.goal * 100));
  return '<section class="card practice-daily daily-quest" aria-label="Daily practice"><div class="practice-heading"><span class="eyebrow">TODAY’S LITTLE WIN</span>' +
    '<a href="#/settings" aria-label="Change daily practice goal">Edit goal</a></div><div class="daily-quest-main"><div class="quest-ring" role="progressbar" aria-label="Daily practice goal" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" style="--quest-progress:' + pct + '%">' +
    '<div>' + pengoIcon(stats.goalMet ? 'check' : 'spark') + '</div></div><div><h2>Your daily practice</h2><strong>' + stats.done + ' <span>/ ' + stats.goal + ' items</span></strong><p class="explain">' +
    (stats.goalMet ? 'Goal complete. You did it!' : 'Effort counts. Mistakes welcome.') + '</p></div></div><div class="practice-week" role="group" aria-label="Last seven days of practice">' +
    stats.week.map(function (d) {
      var label = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
      return '<div class="practice-week-day' + (d.active ? ' active' : '') + '"><span>' + esc(label) + '</span><strong aria-label="' + esc(d.date) + ': ' + d.count + ' items practiced">' + (d.active ? pengoIcon('check') : '&middot;') + '</strong></div>';
    }).join('') + '</div><p class="week-caption">' + stats.active + ' little wins in the last 7 days</p><details class="achievement-drawer"><summary>' + pengoIcon('trophy') + 'Your achievements <span>' + store.practice.badges.length + ' / ' + Practice.BADGES.length + '</span></summary>' +
    practiceBadgesHTML() + '</details></section>';
}
function adventurePathHTML() {
  var c = store.course, batch = courseTodaysBatch(), due = dueCount();
  var practiced = store.practice.history.some(function (h) { return h.date === Course.todayStr(); });
  var steps = [
    { title: 'Refresh your memory', sub: due ? due + ' items ready for another look' : 'All caught up. Nice work!', icon: 'refresh', href: '#/practice?mode=due', done: !due, color: 'mint' },
    { title: 'A little mixed practice', sub: 'Kanji, words & grammar · 3 questions', icon: 'spark', href: '#/practice?start=1&size=3', done: practiced, color: 'gold' },
    { title: batch.complete ? 'Keep your skills growing' : 'Explore today’s discoveries', sub: batch.complete ? 'All plan material is unlocked' : batch.done + ' / ' + batch.items.length + ' studied · Day ' + batch.day, icon: 'book', href: batch.complete ? '#/course/quiz' : '#/course/day', done: batch.complete || batch.items.length > 0 && batch.done === batch.items.length, color: 'lavender' }
  ];
  return '<section class="card learning-path"><div class="path-banner"><span class="eyebrow">YOUR LEARNING TRAIL</span><span class="level-stamp">' + esc(c.target) + '</span>' +
    '<h2>One step at a time</h2><p>' + esc(Course.LEVEL_NAMES[c.target]) + ' Japanese · Day ' + batch.day + '</p></div><ol class="trail-steps">' + steps.map(function (step, i) {
      return '<li class="trail-step ' + step.color + (step.done ? ' step-done' : '') + '"><a href="' + step.href + '"><span class="trail-node">' + pengoIcon(step.done ? 'check' : step.icon) + '</span>' +
        '<span class="trail-copy"><strong>' + esc(step.title) + '</strong><small>' + esc(step.sub) + '</small></span><span class="trail-direction">' + pengoIcon('arrow') + '</span></a></li>';
    }).join('') + '</ol><p class="trail-note">' + esc(courseScheduleText().replace(/&amp;/g, '&')) + '</p></section>';
}
function adventureLibraryHTML(lv) {
  var entries = [['Kanji', '漢', 'Characters that tell stories', 'kanji', 'coral'], ['Vocabulary', '語', 'Words for your everyday world', 'vocab', 'mint'], ['Grammar', '文', 'Make the pieces fit together', 'grammar', 'lavender']];
  return '<section class="discovery-section"><div class="practice-heading"><h2>Pick your playground</h2><a href="#/learn?lv=' + lv + '">See everything ' + pengoIcon('arrow') + '</a></div><div class="discovery-grid">' +
    entries.map(function (e) { return '<a class="discovery-card ' + e[4] + '" href="#/' + e[3] + '/' + lv + '"><span class="discovery-kanji" lang="ja">' + e[1] + '</span><strong>' + e[0] + '</strong><span>' + e[2] + '</span>' + pengoIcon('arrow') + '</a>'; }).join('') + '</div></section>';
}
function renderAdventureHome(view, hasPlan) {
  var stats = practiceStats(), lv = hasPlan ? store.course.target : 'N5';
  var status = '<div class="adventure-top"><span class="eyebrow">YOUR JAPANESE JOURNEY</span><div class="journey-pills"><span class="journey-pill streak-pill">' + pengoIcon('fire') + stats.streak + '<span>day streak</span></span><span class="journey-pill">' + pengoIcon('flag') + esc(lv) + '</span></div></div>';
  var pickLevels = '<section class="card choose-level"><span class="eyebrow">PICK YOUR STARTING POINT</span><h2>Where will we go?</h2><p class="explain">Choose the level you’re preparing for. You can change your plan anytime.</p><div class="adventure-levels">' +
    LEVELS.map(function (l, i) { return '<a class="adventure-level level-' + i + '" href="#/course/setup?target=' + l + '"><span class="level-mark">' + pengoIcon(['spark', 'book', 'flag', 'mountain', 'trophy'][i]) + '</span><span><strong>' + l + '</strong><small>' + esc(Course.LEVEL_NAMES[l]) + '</small></span>' + pengoIcon('arrow') + '</a>'; }).join('') + '</div></section>';
  view.innerHTML = '<div class="adventure-home">' + status + pengoHeroHTML(hasPlan) + '<div class="adventure-columns"><div class="adventure-main">' +
    (hasPlan ? adventurePathHTML() : pickLevels) + adventureLibraryHTML(lv) + '</div><aside class="adventure-aside" aria-label="Your habit and progress">' +
    dailyPracticeCardHTML() + reminderNudgeHTML() + (hasPlan ? '<section class="card course-treasures"><h2>' + pengoIcon('trophy') + 'Learning milestones</h2>' + courseMilestoneHTML() + '</section>' : '') + '</aside></div></div>';
}
function reminderNudgeHTML() {
  var r = Reminders.read();
  return '<section class="card reminder-nudge"><span class="nudge-icon">' + pengoIcon('bell') + '</span><div><h2>Make room for a little Japanese</h2><p>' +
    (r.enabled ? 'Your gentle reminder is set for ' + esc(r.time) + '.' : 'A time that fits your day. One gentle nudge, chosen by you.') + '</p><a href="#/settings?section=reminders">' + (r.enabled ? 'Manage reminders' : 'Choose a reminder') + pengoIcon('arrow') + '</a></div></section>';
}
function bindPengoUI(view) {
  var tips = ['Say the answer out loud before you reveal it. Your brain likes a challenge.', 'A sentence is a little home for a new word. Read one example today.', 'Three questions count. You don’t have to do everything at once.', 'Mistakes are clues. They show us what to practice next.'];
  var tip = $('[data-pengo-tip]', view), bubble = $('[data-pengo-bubble]', view);
  if (tip && bubble) {
    var index = 0;
    tip.addEventListener('click', function () { bubble.hidden = false; bubble.textContent = tips[index++ % tips.length]; });
  }
}
function pengoPracticeCoachHTML(recall) {
  return '<div class="practice-coach"><img src="assets/pengo-study.png" width="52" height="52" alt="" id="practiceCoachImage"><p id="practiceCoachText" role="status">' +
    (recall ? 'Take a breath. Think of the answer, then peek.' : 'You’ve got this. One question at a time.') + '</p></div>';
}
function pengoCelebrationHTML() {
  return '<div class="celebration-sparkles" aria-hidden="true">' + [0,1,2,3,4,5,6,7].map(function (i) { return '<i style="--spark-index:' + i + '"></i>'; }).join('') + '</div>';
}

function practiceQuickChoicesHTML(cfg,counts,saved) {
  var choices=[['smart','spark','A little of everything','3 questions · your daily mix','mint'],
    ['due','refresh','Freshen up your memory',counts.due+' due for review','lavender'],
    ['mistakes','book','Turn mistakes into wins',counts.mistakes+' items to revisit','coral'],
    ['recall','flag','Think, then peek','Recall cards · no answer clues','gold']];
  return '<section class="quick-practice-section"><div class="practice-heading"><h2>What feels right today?</h2><span class="eyebrow">A SMALL START COUNTS</span></div><div class="quick-practice-grid">'+choices.map(function(c){
    return '<button class="quick-practice-card '+c[4]+'" data-quick-practice="'+c[0]+'"'+(saved?' disabled':'')+'><span class="quick-practice-icon">'+pengoIcon(c[1])+'</span><strong>'+c[2]+'</strong><small>'+c[3]+'</small><span class="quick-practice-arrow">'+pengoIcon('arrow')+'</span></button>';
  }).join('')+'</div></section>';
}
