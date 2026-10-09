"use strict";
var homeDate = null;
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
    refresh: '<path d="M20 8V3l-4 4M4 16v5l4-4M4 10a8 8 0 0 1 14-5m2 9a8 8 0 0 1-14 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v8h5v-8Zm16 0h2v8h-5v-8Z"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" class="pengo-symbol" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.spark) + '</svg>';
}
function pengoHeroHTML(hasPlan) {
  var stats = practiceStats(), session = practiceSession();
  var title = stats.goalMet ? 'Look at you go!' : stats.breakDays >= 2 ? 'Your next chapter starts here.' : hasPlan ? 'Small steps. Big adventures.' : 'Japanese is an adventure.';
  var subtitle = stats.goalMet ? 'Today’s goal is in the bag. Pengo is proud of you.' : hasPlan ? 'A few words today. A little more confidence tomorrow.' : 'Meet Pengo, your study buddy. Let’s make a little progress together.';
  var href = !hasPlan ? '#/course/setup' : session ? (session.config.format === 'recall' ? '#/flashcards?resume=1' : '#/learn?section=quiz&resume=1') : stats.goalMet ? '#/progress' : '#/learn?section=quiz&start=1&size=3';
  return '<section class="adventure-hero"><div class="hero-copy"><span class="eyebrow">' + (hasPlan ? esc(courseGreeting()) : 'HELLO, FUTURE YOU') + '</span>' +
    '<h1>' + title + '</h1><p>' + subtitle + '</p><a class="btn primary hero-start" href="' + href + '">' +
    (!hasPlan ? 'Plan my adventure' : session ? 'Continue your session' : stats.goalMet ? 'Celebrate your progress' : 'Let’s practice') + pengoIcon('arrow') + '</a>' +
    '<span class="hero-footnote">' + (!hasPlan ? 'Your level. Your pace. No pressure.' : session ? 'Pick up right where you left off' : stats.goalMet ? 'You’ve earned a breather' : 'Just 3 questions to get going') + '</span></div>' +
    '<div class="hero-art"><span class="hero-orbit orbit-one" aria-hidden="true">あ</span><span class="hero-orbit orbit-two" aria-hidden="true">' + pengoIcon('spark') + '</span>' +
    '<img class="hero-pengo" src="assets/pengo-adventure.png" width="250" height="270" alt="Pengo waving, ready for your next learning adventure">' +
    '<button class="pengo-tip" data-pengo-tip aria-label="Ask Pengo for a study tip">Pengo’s tip ' + pengoIcon('spark') + '</button>' +
    '<p class="pengo-bubble" data-pengo-bubble role="status" aria-live="polite" hidden></p></div></section>';
}
function dailyPracticeCardHTML() {
  var stats = practiceStats(), pct = Math.min(100, Math.round(stats.done / stats.goal * 100));
  return '<section class="card practice-daily daily-quest" aria-label="Daily practice"><div class="practice-heading">' +
    '<a href="#/settings" aria-label="Change daily practice goal">Edit goal</a></div><div class="daily-quest-main"><div class="quest-ring" role="progressbar" aria-label="Daily practice goal" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" style="--quest-progress:' + pct + '%">' +
    '<div>' + pengoIcon(stats.goalMet ? 'check' : 'spark') + '</div></div><div><h2>Your daily practice</h2><strong>' + stats.done + ' <span>/ ' + stats.goal + ' items</span></strong><p class="explain">' +
    (stats.goalMet ? 'Goal complete. You did it!' : 'Effort counts. Mistakes welcome.') + '</p></div></div><div class="practice-week" role="group" aria-label="Last seven days of practice">' +
    stats.week.map(function (d) {
      var label = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
      return '<div class="practice-week-day' + (d.active ? ' active' : '') + '"><span>' + esc(label) + '</span><strong aria-label="' + esc(d.date) + ': ' + d.count + ' items practiced">' + (d.active ? pengoIcon('check') : '&middot;') + '</strong></div>';
    }).join('') + '</div><p class="week-caption">' + stats.active + ' little wins in the last 7 days</p><details class="achievement-drawer"><summary>' + pengoIcon('trophy') + 'Your achievements <span>' + store.practice.badges.length + ' / ' + Practice.BADGES.length + '</span></summary>' +
    practiceBadgesHTML() + '</details></section>';
}
function adventureLibraryHTML(lv) {
  var entries = [['Kanji', '漢', 'Characters that tell stories', 'kanji', 'coral'], ['Vocabulary', '語', 'Words for your everyday world', 'vocab', 'mint'], ['Grammar', '文', 'Make the pieces fit together', 'grammar', 'lavender']];
  return '<section class="discovery-section"><div class="practice-heading"><h2>Pick your playground</h2><a href="#/learn?lv=' + lv + '">See everything ' + pengoIcon('arrow') + '</a></div><div class="discovery-grid">' +
    entries.map(function (e) { return '<a class="discovery-card ' + e[4] + '" href="#/' + e[3] + '/' + lv + '"><span class="discovery-kanji" lang="ja">' + e[1] + '</span><strong>' + e[0] + '</strong><span>' + e[2] + '</span>' + pengoIcon('arrow') + '</a>'; }).join('') + '</div></section>';
}
function flashcardEntryHTML(lv) {
  return '<section class="card flashcard-entry" aria-label="Daily flashcards"><div class="flashcard-preview" aria-hidden="true"><span lang="ja">語</span><span lang="ja">日</span></div>' +
    '<div><h2>Today’s flashcards</h2></div>' +
    '<a class="btn primary" href="#/flashcards?daily=1&lv=' + lv + '">Start learning ' + pengoIcon('arrow') + '</a></section>';
}
function renderAdventureHome(view, hasPlan) {
  homeDate = Course.todayStr();
  var stats = practiceStats(), lv = hasPlan ? store.course.target : 'N5';
  var status = '<div class="adventure-top"><span class="eyebrow">YOUR JAPANESE JOURNEY</span><div class="journey-pills"><span class="journey-pill streak-pill">' + pengoIcon('fire') + stats.streak + '<span>day streak</span></span><span class="journey-pill">' + pengoIcon('flag') + esc(lv) + '</span></div></div>';
  var pickLevels = '<section class="card choose-level"><span class="eyebrow">PICK YOUR STARTING POINT</span><h2>Where will we go?</h2><p class="explain">Choose the level you’re preparing for. You can change your plan anytime.</p><div class="adventure-levels">' +
    LEVELS.map(function (l, i) { return '<a class="adventure-level level-' + i + '" href="#/course/setup?target=' + l + '"><span class="level-mark">' + pengoIcon(['spark', 'book', 'flag', 'mountain', 'trophy'][i]) + '</span><span><strong>' + l + '</strong><small>' + esc(Course.LEVEL_NAMES[l]) + '</small></span>' + pengoIcon('arrow') + '</a>'; }).join('') + '</div></section>';
  view.innerHTML = '<div class="adventure-home">' + status + pengoHeroHTML(hasPlan) + flashcardEntryHTML(lv) + '<div class="adventure-columns"><div class="adventure-main">' +
    (hasPlan ? '' : pickLevels) + dailyOverviewHTML(lv) + dailyChallengesHTML(lv) + adventureLibraryHTML(lv) + '</div><aside class="adventure-aside" aria-label="Your habit and progress">' +
    dailyPracticeCardHTML() + dailyWordHTML(lv) + reminderNudgeHTML() + (hasPlan ? '<section class="card course-treasures"><h2>' + pengoIcon('trophy') + 'Learning milestones</h2>' + courseMilestoneHTML() + '</section>' : '') + '</aside></div></div>';
}
function dailyOverviewHTML(lv) {
  var s = Dashboard.summary(store.study.days, Course.todayStr());
  var labels = [['kanji', '漢', 'Kanji', 'coral'], ['vocab', '語', 'Vocabulary', 'mint'], ['grammar', '文', 'Grammar', 'lavender']];
  return '<section class="card today-overview"><div class="practice-heading"><div><span class="eyebrow">' +
    esc(new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })) + '</span><h2>Your day, in little steps</h2></div><a href="#/today">View items</a></div>' +
    '<div class="today-subjects">' + labels.map(function (e) {
      return '<a class="today-subject ' + e[3] + '" href="#/today?kind=' + e[0] + '"><span class="subject-mark" lang="ja">' + e[1] +
        '</span><strong data-today-count="' + e[0] + '">' + s.counts[e[0]] + '</strong><span>' + e[2] + ' today</span></a>';
    }).join('') + '</div></section>';
}
function dailyChallengesHTML(lv) {
  var quests = Dashboard.challenges(store.study.days, Course.todayStr(), store.settings.dailyGoal, lv);
  var done = quests.filter(function (q) { return q.done; }).length;
  return '<section class="card daily-challenges"><div class="practice-heading"><div><span class="eyebrow">A FRESH ADVENTURE EACH DAY</span><h2>Daily challenges</h2></div><span class="challenge-score">' + done + ' / ' + quests.length + '</span></div>' +
    '<ul class="challenge-list">' + quests.map(function (q) {
      return '<li data-challenge="' + q.id + '" class="' + (q.done ? 'challenge-done' : '') + '"><div class="challenge-status"><span class="challenge-icon">' + pengoIcon(q.done ? 'check' : q.icon) +
        '</span><span class="challenge-copy"><strong>' + q.title + '</strong><small>' + q.hint + '</small>' + progressBar(q.percent, q.title) + '</span><span class="challenge-count">' +
        (q.done ? '<span class="sr-only">Complete: </span>' : '') + Math.min(q.count, q.target) + ' / ' + q.target + '</span></div></li>';
    }).join('') + '</ul></section>';
}
function dailyWordHTML(lv) {
  var words = DB.vocab[lv] || [], v = words[Dashboard.dailyIndex(Course.todayStr(), words.length)];
  if (!v) return '';
  return '<section class="card daily-word"><span class="eyebrow">TODAY’S WORD TO TAKE WITH YOU</span><h2 lang="ja">' + esc(v.word) + '</h2><p lang="ja">' + esc(v.reading) +
    '</p><p>' + esc(v.meaning) + '</p><div class="practice-actions">' + '<a class="btn soft" href="#/v/' + encodeURIComponent(v.id) + '">Explore word</a></div></section>';
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
    ['mistakes','book','Turn mistakes into wins',counts.mistakes+' items to revisit','coral']];
  return '<section class="quick-practice-section"><div class="practice-heading"><h2>Choose a quick quiz</h2><span class="eyebrow">TEST YOUR PROGRESS</span></div><div class="quick-practice-grid">'+choices.map(function(c){
    return '<button class="quick-practice-card '+c[4]+'" data-quick-practice="'+c[0]+'"'+(saved?' disabled':'')+'><span class="quick-practice-icon">'+pengoIcon(c[1])+'</span><strong>'+c[2]+'</strong><small>'+c[3]+'</small><span class="quick-practice-arrow">'+pengoIcon('arrow')+'</span></button>';
  }).join('')+'</div></section>';
}
