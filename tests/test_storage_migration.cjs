/* Exercise the real startup/storage code with pre-rename user progress. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8').split('\nfunction studyDateKey')[0];
const Practice = require('../practice.js');
const legacyKey = 'knowkanji:v1';
const currentKey = 'pengo:v1';
const progress = JSON.stringify({ learned: { '字': 123 }, notes: { '字': 'My memory aid' },
  vLearned: { 'N5-123-0': 456 }, gLearned: { 'N5-g1': 789 },
  settings: { theme: 'dark', dailyGoal: 10 }, course: { target: 'N4' },
  practice: { history: [], badges: [], mistakes: {} } });
let checks = 0;
function test(name, run) { run(); checks++; }
function boot(initial = {}, failures = {}) {
  const values = new Map(Object.entries(initial));
  const context = vm.createContext({ Practice, localStorage: {
    getItem(key) { if (failures.read) throw Error('unavailable'); return values.get(key) ?? null; },
    setItem(key, value) { if (failures.write) throw Error('full'); values.set(key, value); },
    removeItem(key) { if (failures.remove) throw Error('unavailable'); values.delete(key); }
  } });
  vm.runInContext(source, context);
  return { values, context, state: JSON.parse(vm.runInContext('JSON.stringify(store)', context)) };
}
test('fresh profile starts normally without creating a legacy key', () => {
  const { values, state } = boot();
  assert.equal(values.size, 0);
  assert.deepEqual(state.learned, {});
});
test('legacy progress migrates, retaining notes, subjects, settings and plan', () => {
  const { values, state } = boot({ [legacyKey]: progress });
  assert.equal(values.get(currentKey), progress);
  assert.equal(values.has(legacyKey), false);
  assert.equal(state.learned['字'], 123);
  assert.equal(state.notes['字'], 'My memory aid');
  assert.equal(state.vLearned['N5-123-0'], 456);
  assert.equal(state.gLearned['N5-g1'], 789);
  assert.equal(state.settings.theme, 'dark');
  assert.equal(state.settings.dailyGoal, 10);
  assert.equal(state.course.target, 'N4');
});
test('existing Pengo state wins over stale legacy state, including erased progress', () => {
  const current = JSON.stringify({ learned: {}, notes: {} });
  const { state, values } = boot({ [currentKey]: current, [legacyKey]: progress });
  assert.deepEqual(state.learned, {});
  assert.equal(values.get(currentKey), current);
});
test('failed migration write retains the source and loads progress into memory', () => {
  const { state, values } = boot({ [legacyKey]: progress }, { write: true });
  assert.equal(state.notes['字'], 'My memory aid');
  assert.equal(values.get(legacyKey), progress);
  assert.equal(values.has(currentKey), false);
});
test('failed legacy cleanup does not undo the successful migration', () => {
  const { state, values } = boot({ [legacyKey]: progress }, { remove: true });
  assert.equal(state.learned['字'], 123);
  assert.equal(values.get(currentKey), progress);
  assert.equal(boot(Object.fromEntries(values)).state.learned['字'], 123);
});
test('malformed legacy JSON is retained without being migrated', () => {
  const { values, state } = boot({ [legacyKey]: '{broken' });
  assert.equal(values.get(legacyKey), '{broken');
  assert.equal(values.has(currentKey), false);
  assert.deepEqual(state.learned, {});
});
test('non-object legacy JSON is not treated as valid progress', () => {
  for (const raw of ['null', '[]', '7', '"text"']) {
    const { values } = boot({ [legacyKey]: raw });
    assert.equal(values.has(currentKey), false);
    assert.equal(values.get(legacyKey), raw);
  }
});
test('corrupt Pengo state does not resurrect stale legacy progress', () => {
  const { state, values } = boot({ [currentKey]: '{broken', [legacyKey]: progress });
  assert.deepEqual(state.learned, {});
  assert.equal(values.get(currentKey), '{broken');
});
test('unavailable storage does not prevent startup', () => {
  assert.deepEqual(boot({}, { read: true }).state.learned, {});
});
test('subsequent writes and reloads use only the new key', () => {
  const { context, values } = boot({ [legacyKey]: progress });
  assert.equal(vm.runInContext('store.notes["字"] = "Updated"; save()', context), true);
  const again = boot(Object.fromEntries(values));
  assert.equal(again.state.notes['字'], 'Updated');
  assert.equal(again.values.has(legacyKey), false);
});
console.log('Progress storage migration:', checks, 'checks passed');
