const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'course.js'),'utf8') + fs.readFileSync(path.join(root,'practice.js'),'utf8'), ctx);
const P = ctx.Practice;
const plain = v => JSON.parse(JSON.stringify(v));
let checks = 0;
function test(name, fn) { fn(); checks++; }
const pool = [
 {type:'kanji',id:'a',lv:'N5'}, {type:'vocab',id:'b',lv:'N5'},
 {type:'grammar',id:'c',lv:'N5'}, {type:'kanji',id:'d',lv:'N5'}, {type:'kanji',id:'a',lv:'N4'},
 {type:'kanji',id:'e',lv:'N5'}
];
const reviews = {a:{inSrs:true,isDue:true,due:200},b:{inSrs:true,isDue:false,due:400},
 c:{inSrs:true,isDue:true,due:100},d:{inSrs:false,isDue:false},e:{inSrs:true,isDue:true,due:50}};
const srs = item=>reviews[item.id];
const state = item=>srs(item).inSrs?'weak':'new';
const cfg = mode=>P.config({mode,kind:'mixed',size:3,lv:'N5'});
test('bounded session and goal defaults',()=>{ assert.equal(P.size(100),5); assert.equal(P.goal(1),5); assert.equal(P.goal(20),20); });
test('invalid route values normalized',()=>assert.deepEqual(plain(P.config({mode:'other',kind:'other',lv:'bad',format:'other',size:'3'},'N4')),
 {mode:'smart',kind:'mixed',lv:'N4',size:3,format:'quiz'}));
test('due-only oldest first, unique across overlapping levels',()=>assert.deepEqual(plain(P.select(pool,cfg('due'),srs,{},state,()=>0)).map(x=>x.id),['e','c','a']));
test('due excludes future and new items',()=>{const all=P.select(pool,{...cfg('due'),size:10},srs,{},state);assert.equal(all.length,3);assert.ok(all.every(x=>srs(x).isDue));});
test('due content filter',()=>assert.deepEqual(plain(P.select(pool,{...cfg('due'),kind:'grammar'},srs,{},state)).map(x=>x.id),['c']));
test('mistakes are isolated',()=>assert.deepEqual(plain(P.select(pool,cfg('mistakes'),srs,{'vocab:b':true},state,()=>0)).map(x=>x.id),['b']));
test('empty mistakes does not fall back to random new material',()=>assert.equal(P.select(pool,cfg('mistakes'),srs,{},state).length,0));
test('mixed sessions cover available skills',()=>assert.deepEqual(new Set(P.select(pool,cfg('smart'),srs,{},state,()=>0).map(x=>x.type)),new Set(['kanji','vocab','grammar'])));
test('single-kind smart starts with overdue items',()=>assert.deepEqual(plain(P.select(pool,{...cfg('smart'),kind:'kanji'},srs,{},state,()=>0)).slice(0,2).map(x=>x.id),['e','a']));
test('sessions never exceed bounds or repeat items',()=>{for(const size of [3,5,10]){const result=P.select(pool,{...cfg('smart'),size},srs,{},state,()=>0.3);assert.ok(result.length<=size);assert.equal(new Set(result.map(P.key)).size,result.length);}});
test('new successful answer enters SRS',()=>{const s=P.nextReview(null,true,1000,'2026-10-07');assert.equal(s.box,1);assert.ok(s.due>1000);});
test('missed answer resets SRS and returns in ten minutes',()=>{const s=P.nextReview({box:6},false,1000,'2026-10-07');assert.equal(s.box,0);assert.equal(s.due,601000);});
test('same-day retry cannot inflate mastery or postpone due',()=>{const first=P.nextReview({box:2},true,1000,'2026-10-07');const retry=P.nextReview(first,true,2000,'2026-10-07');assert.equal(first.box,retry.box);assert.equal(first.due,retry.due);});
test('next-day recall can promote',()=>{const first=P.nextReview(null,true,1000,'2026-10-07');assert.equal(P.nextReview(first,true,2000,'2026-10-08').box,2);});
test('same-day failure stays reviewable after correct retry',()=>{const first=P.nextReview(null,true,1000,'2026-10-07');const miss=P.nextReview(first,false,2000,'2026-10-07');const retry=P.nextReview(miss,true,3000,'2026-10-07');assert.equal(retry.box,0);assert.equal(retry.due,602000);});
test('invalid imported SRS boxes remain bounded',()=>assert.equal(P.nextReview({box:999},true,1000,'2026-10-07').box,6));
test('old backup receives empty practice state',()=>assert.deepEqual(plain(P.normalize(null)),{session:null,history:[],badges:[],mistakes:{}}));
test('corrupt practice containers normalized',()=>{const p=P.normalize({history:{},badges:['bad','comeback'],mistakes:[]});assert.deepEqual(plain(p.history),[]);assert.deepEqual(plain(p.badges),['comeback']);assert.deepEqual(plain(p.mistakes),{});});
test('history is bounded',()=>assert.equal(P.normalize({history:Array.from({length:100},()=>({date:'2026-10-07',total:3,score:2}))}).history.length,60));
const session = {version:1,id:'session',config:{...cfg('smart'),format:'quiz'},questions:[{type:'kanji',id:'a',lv:'N5',variant:0,options:['a','d']}],cursor:0,answers:[]};
const exists = q=>pool.some(i=>i.type===q.type && i.id===q.id);
test('unanswered saved session accepted',()=>assert.ok(P.validSession(session,exists)));
test('answered feedback state accepted for resume',()=>assert.ok(P.validSession({...session,answers:[{ok:false,selected:'d'}]},exists)));
test('completed cursor accepted for idempotent finish',()=>assert.ok(P.validSession({...session,cursor:1,answers:[{ok:true,selected:'a'}]},exists)));
test('unknown saved content rejected',()=>assert.equal(P.validSession({...session,questions:[{...session.questions[0],id:'missing'}]},exists),false));
test('missing distractor rejected',()=>assert.equal(P.validSession({...session,questions:[{...session.questions[0],options:['a','missing']}]},exists),false));
test('invalid cursor and missing answer rejected',()=>{assert.equal(P.validSession({...session,cursor:2},exists),false);assert.equal(P.validSession({...session,cursor:1},exists),false);});
test('duplicate question ids rejected',()=>assert.equal(P.validSession({...session,questions:[session.questions[0],session.questions[0]]},exists),false));
test('duplicate answer labels/references rejected',()=>assert.equal(P.validSession({...session,questions:[{...session.questions[0],options:['a','a']}]},exists),false));
test('malformed saved config rejected',()=>assert.equal(P.validSession({...session,config:{mode:'due',format:'quiz',size:999}},exists),false));
test('recall card supports one-item datasets',()=>assert.ok(P.validSession({...session,config:{...session.config,format:'recall'},questions:[{...session.questions[0],options:[]}]},exists)));
test('invalid answer choices rejected',()=>assert.equal(P.validSession({...session,answers:[{ok:true,selected:'bad'}]},exists),false));
test('unique effort counts wrong attempts and newly studied items',()=>assert.equal(P.count({learned:1,practiced:{'kanji:a':true,'vocab:b':true},attempts:10}),2));
test('legacy learned counts are preserved',()=>{assert.equal(P.count({learned:4}),4);assert.equal(P.count({legacyLearned:4,practiced:{a:true}}),5);});
const days={'2026-10-01':{practiced:{a:true},attempts:10},'2026-10-02':{practiced:{b:true},attempts:10},
 '2026-10-03':{practiced:{c:true},attempts:10},'2026-10-04':{practiced:{d:true},attempts:10},
 '2026-10-07':{practiced:{e:true,f:true,g:true},attempts:60}};
test('weekly activity includes today and six prior days',()=>{const s=P.stats(days,'2026-10-07',3);assert.equal(s.week.length,7);assert.equal(s.week[0].date,'2026-10-01');assert.equal(s.active,5);assert.equal(s.done,3);assert.equal(s.goalMet,true);assert.equal(s.attempts,100);});
test('returning after a gap gets supportive comeback',()=>assert.equal(P.stats(days,'2026-10-07',3).breakDays,2));
test('activity streak uses practice, not passive time',()=>{const s=P.stats({...days,'2026-10-06':{seconds:100}},'2026-10-07',3);assert.equal(s.streak,1);assert.equal(s.active,5);});
test('all badges derive from real effort and are awarded once',()=>{const stats=P.stats(days,'2026-10-07',3);assert.equal(P.earned(stats,[]).length,5);assert.equal(P.earned(stats,P.BADGES.map(x=>x.id)).length,0);});
test('empty activity earns no badge and shows no gap',()=>{const s=P.stats({},'2026-10-07',3);assert.equal(s.breakDays,0);assert.equal(P.earned(s,[]).length,0);});
console.log('Practice:',checks,'checks passed');
