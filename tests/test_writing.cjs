const assert = require('node:assert/strict');
const W = require('../writing.js');
let checks = 0;
function check(input, reference, expected, label) {
  assert.equal(W.grade(input, reference).ok, expected, label); checks++;
}
const line = [{x:15,y:30},{x:90,y:30}];
check(line, line, true, 'exact horizontal stroke');
check([{x:16,y:32},{x:20,y:31},{x:80,y:28},{x:88,y:29}], line, true, 'finger jitter and uneven event spacing');
assert.equal(W.grade(line.slice().reverse(), line).reason, 'direction'); checks++;
check([{x:15,y:30}], line, false, 'a tap is not a stroke');
check([{x:15,y:30},{x:30,y:30}], line, false, 'incomplete stroke');
check([{x:15,y:30},{x:160,y:30}], line, false, 'excess length');
check(line.map(p=>({x:p.x,y:p.y+20})), line, false, 'wrong position');
check([{x:15,y:30},{x:50,y:65},{x:90,y:30}], line, false, 'correct endpoints do not excuse wrong shape');
check([{x:15,y:30},{x:90,y:30},{x:15,y:30},{x:90,y:30}], line, false, 'backtracking scribble');
check([{x:15,y:30},{x:15,y:90}], line, false, 'wrong direction and shape');
const hook = [{x:70,y:15},{x:70,y:75},{x:65,y:85},{x:55,y:82}];
check(W.resample(hook, 90), hook, true, 'joined turn and hook stay one stroke');
check([{x:70,y:15},{x:55,y:82}], hook, false, 'shortcut across a hook');
check(hook.slice().reverse(), hook, false, 'reversed hook');
const dot = [{x:35,y:20},{x:39,y:24},{x:40,y:28}];
check(dot.map(p=>({x:p.x+1,y:p.y-1})), dot, true, 'short dot allows small finger error');
const tiny = [{x:30,y:20},{x:32,y:22}];
check(tiny.slice().reverse(), tiny, false, 'direction is checked even for very short dots');
check([{x:39,y:25},{x:39.1,y:25.1}], dot, false, 'tiny dot cannot pass a complete stroke');
for (const input of [[], null, [{x:NaN,y:1},{x:2,y:3}], [{x:1,y:1},{x:Infinity,y:2}]]) {
  check(input, line, false, 'malformed input cannot pass');
}
check(line, [{x:2,y:2},{x:2,y:2}], false, 'empty reference cannot pass');
assert.deepEqual(W.resample(line, 3), [{x:15,y:30},{x:52.5,y:30},{x:90,y:30}]); checks++;
console.log('Writing geometry: ' + checks + ' checks passed');
