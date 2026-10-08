"use strict";
/* Date-scoped motivation rules; no separate rewards to drift from study activity. */
var Dashboard = (() => {
  function summary(days, today) {
    const day = (days || {})[today] || {}, counts = { kanji: 0, vocab: 0, grammar: 0 };
    Object.keys(day.practiced || {}).forEach(key => {
      const type = key.split(':')[0];
      if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type]++;
    });
    return { counts, distinct: Object.values(counts).reduce((a, b) => a + b, 0),
      attempts: Math.max(0, Number(day.attempts) || 0), correct: Math.max(0, Number(day.correct) || 0),
      learned: Math.max(0, Number(day.learned) || 0),
      reviewed: Object.keys(day.reviewed || {}).length,
      recalled: Object.keys(day.recalled || {}).length };
  }
  function challenges(days, today, goal, lv) {
    const s = summary(days, today), n = Practice.goal(goal);
    const rotation = Math.abs(Course.diffDays('2026-01-01', today)) % 3;
    const type = ['kanji', 'vocab', 'grammar'][rotation], target = Math.min(3, n);
    const quests = [
      { id: 'daily', title: 'Make your little daily win', hint: 'Study or review ' + n + ' different items.', count: Practice.count((days || {})[today]), target: n,
        href: '#/practice?start=1&format=recall&size=' + (n === 3 ? 3 : 5) + '&lv=' + lv, icon: 'spark' },
      { id: 'focus', title: ['Kanji explorer', 'Word collector', 'Grammar detective'][rotation], hint: 'Give ' + target + ' ' + (type === 'vocab' ? 'vocabulary' : type) + ' items a little attention.',
        count: s.counts[type], target, href: '#/practice?start=1&format=recall&mode=explore&size=3&kind=' + type + '&lv=' + lv, icon: 'book' },
      { id: 'flip', title: 'Three kanji, three discoveries', hint: 'Guess, flip, and rate 3 kanji cards.',
        count: Object.keys(((days || {})[today] || {}).recalled || {}).filter(k => k.startsWith('kanji:')).length, target: 3,
        href: '#/practice?start=1&mode=explore&size=3&kind=kanji&format=recall&lv=' + lv, icon: 'refresh' }
    ];
    return quests.map(q => Object.assign(q, { done: q.count >= q.target, percent: Math.min(100, Math.round(q.count / q.target * 100)) }));
  }
  function dailyIndex(today, length) {
    return length ? Math.abs(Course.diffDays('2026-01-01', today)) % length : 0;
  }
  return { summary, challenges, dailyIndex };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Dashboard;
