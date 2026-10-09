/* Direct quiz choices, independent resume/replacement, durable visual history and layout. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-quiz-redesign-qa';
let checks=0;function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  await route('#/learn');
  check(await page.locator('.quiz-history').count()===0,'empty history has no placeholder result');
  check(await page.locator('#practiceForm,.practice-custom,.practice-daily,[data-quick-practice]').count()===0,'Learn removes custom form, daily practice and old quick controls');
  const text=await page.locator('#view').textContent();
  check(!/Discover something|Take your time|Check your progress|Choose a quick quiz|Build your own quiz|Your daily practice/i.test(text),'retired titles and introductory copy removed');
  check(await page.locator('.quiz-choice').count()===4,'four subject quiz choices');
  check(await page.locator('#view select').count()===0,'no quiz setup dropdowns');
  for(const kind of ['kanji','vocab','grammar','mixed']){
   await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;save();});await route('#/learn?lv=N3');
   await page.locator('.quiz-choice[data-quiz-kind='+kind+']').click();await page.waitForSelector('[data-answer]');
   const quiz=(await state()).practice.session;
   check(quiz.config.kind===kind&&quiz.config.lv==='N3'&&quiz.questions.length===5,'one tap starts five '+kind+' questions at selected level');
   check(kind==='mixed'?new Set(quiz.questions.map(q=>q.type)).size===3:quiz.questions.every(q=>q.type===kind),kind+' respects subject choice');
  }
  // A new choice starts plan quizzes from unlocked material.
  await page.evaluate(()=>{store.practice.session=null;store.course=Course.defaultCourse('N3');save();});await route('#/learn');
  check(await page.locator('.study-focus svg,[data-lv]').count()===0,'plan heading has no redundant level icon or chips');
  check(await page.locator('.study-focus strong').textContent()==='Your N3 adventure','plan title retained');
  await page.locator('.quiz-choice[data-quiz-kind=mixed]').click();
  check(await page.evaluate(()=>store.practice.session.questions.every(q=>courseUnlocked().all.some(item=>item.type===q.type&&item.id===q.id))),'default plan quiz uses unlocked items');
  const id=(await state()).practice.session.id;
  await page.locator('[data-answer]').evaluateAll(buttons=>buttons.find(b=>b.dataset.answer!==store.practice.session.questions[0].id).click());
  const graded=await state();await page.reload();await page.waitForSelector('#practiceResume');
  check(await page.locator('#quizChoices').isHidden(),'saved quiz prioritizes Continue');
  await page.locator('#practiceResume').click();
  check((await state()).practice.session.id===id&&(await state()).practice.session.answers.length===1,'reload continues exact answered quiz');
  assert.deepEqual((await state()).study,graded.study);checks++;
  await page.locator('#practicePause').click();await page.waitForSelector('#practiceReplace');
  await page.locator('#practiceReplace').click();check(await page.locator('#quizChoices').isVisible(),'new quiz button reveals simple choices');
  check((await state()).practice.session.id===id,'opening choices keeps saved quiz');
  await page.locator('#practiceReplace').click();check(await page.locator('#quizChoices').isHidden(),'can keep saved quiz without replacement');
  await page.locator('#practiceReplace').click();await page.locator('.quiz-choice[data-quiz-kind=vocab]').click();
  check((await state()).practice.session.id!==id,'choosing subject creates replacement quiz');
  assert.deepEqual((await state()).study,graded.study);checks++;
  assert.deepEqual((await state()).practice.mistakes,graded.practice.mistakes);checks++;
  // Finish once and verify history fields and persistence; complete twice cannot duplicate it.
  const completed=(await state()).practice.session.id;
  for(let i=0,n=(await state()).practice.session.questions.length;i<n;i++){
   await page.locator('[data-answer]').evaluateAll(buttons=>buttons.find(b=>b.dataset.answer===store.practice.session.questions[store.practice.session.cursor].id).click());
   await page.locator('#practiceNext').click();
  }
  const history=(await state()).practice.history;
  check(history.length===1&&history[0].kind==='vocab'&&history[0].score===history[0].total&&Number.isFinite(history[0].completedAt),'new result records subject, timestamp and score');
  await route('#/learn');check(await page.locator('.quiz-history-item[data-quiz-id="'+completed+'"]').count()===1,'completed result appears exactly once');
  await page.reload();await page.waitForSelector('.quiz-history');
  check(await page.locator('.quiz-history-ring').getAttribute('aria-label').then(s=>s.includes('100 percent')),'perfect result has accessible percentage');
  // Due and mistake shortcuts appear only for real work; due quizzes respect filters.
  await page.evaluate(()=>{store.course=null;store.srs={};store.vSrs={};store.gSrs={};store.practice.mistakes={};store.practice.session=null;save();});await route('#/learn');
  check(await page.locator('.quiz-review-choices').count()===0,'no empty due or mistake controls');
  await page.evaluate(()=>{const item=DB.grammar.N4[0];store.gSrs[item.id]={box:1,due:Date.now()-100};store.practice.mistakes['grammar:'+item.id]={type:'grammar',id:item.id};save();});await route('#/learn');
  check(await page.locator('.quiz-review-choices button').count()===2,'real due and mistake work gets compact shortcuts');
  await page.locator('.quiz-review-choices [data-quiz-mode=due]').click();
  check((await state()).practice.session.questions.every(q=>q.type==='grammar'&&q.lv==='N4'),'due shortcut opens actual due items across free-study levels');
  // Last ten quiz results remain after many recall decks, including legacy results.
  await page.evaluate(()=>{
   store.practice.session=null;
   store.practice.history=Array.from({length:12},(_,i)=>({id:'quiz-'+i,date:'2026-10-'+String(i+1).padStart(2,'0'),score:i===9?1:i===10?4:i===11?3:0,total:i===9?3:i===10?5:10,lv:'N3',format:'quiz',...(i===11?{}:{kind:['mixed','kanji','vocab','grammar'][i%4]})})).concat(Array.from({length:70},(_,i)=>({id:'recall-'+i,date:'2026-10-12',score:3,total:3,format:'recall'})));
   store.practice=Practice.normalize(store.practice);save();
  });await route('#/learn');
  check(await page.locator('.quiz-history-item').count()===10,'history shows ten quizzes, excluding recall');
  assert.deepEqual(await page.locator('.quiz-history-item').evaluateAll(items=>items.map(i=>i.dataset.quizId)),Array.from({length:10},(_,i)=>'quiz-'+(11-i)));checks++;
  check(await page.locator('.quiz-history-item').first().locator('strong').textContent()==='Quiz','legacy result remains readable without invented subject');
  assert.deepEqual((await page.locator('.quiz-history-ring text').allTextContents()).slice(0,3),['30%','80%','33%']);checks++;
  const backup=await page.evaluate(()=>JSON.stringify(store));check(await page.evaluate(text=>importBackupText(text),backup),'new history supports backup roundtrip');await route('#/learn');
  check(await page.locator('.quiz-history-item').count()===10,'backup and reload preserve last ten quizzes');
  for(const width of [320,390,768,1024,1440])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:900});await page.evaluate(t=>{store.settings.theme=t;save();applyTheme();},theme);await route('#/learn');
   check(await page.locator('.learn-subjects .level-card').evaluateAll(cards=>{const r=cards.map(c=>c.getBoundingClientRect());return r.length===3&&cards.every(c=>c.offsetTop===cards[0].offsetTop)&&r[0].right<=r[1].left&&r[1].right<=r[2].left;}),width+' '+theme+' subjects stay on one line');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' page has no horizontal overflow');
   check(await page.locator('.quiz-history-list').evaluate(el=>el.scrollWidth>el.clientWidth),width+' '+theme+' history scroll stays in its own list');
   await page.screenshot({path:artifacts+'/learn-'+width+'-'+theme+'.png',fullPage:true});
  }
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Quiz redesign: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
