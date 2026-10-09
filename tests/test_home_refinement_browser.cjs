/* Home focus, challenge-sized decks, uniform recap and device-local dismissal. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-home-refinement-qa';
let checks=0;function check(v,label){assert.ok(v,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(10000);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>{history.replaceState(null,'',h);render();},hash);}
  await route('#/');
  check(await page.locator('.flashcard-entry,.practice-daily,.discovery-section,.course-treasures').count()===0,'Home removes duplicate learning/library/practice/milestones cards');
  check(await page.locator('.hero-start').textContent().then(s=>s.includes('Start learning')),'hero starts cards without a plan');
  check(await page.locator('ol.today-subjects li').count()===3,'daily overview uses a subject list');
  check(await page.locator('.today-subject-row').first().evaluate(el=>getComputedStyle(el,'::after').content!=='none'),'subject icons have a connecting line');
  await page.locator('.today-subject.mint').click();await page.waitForSelector('[data-today-subject=vocab]');
  check(await page.locator('.today-items').count()===1,'list row opens filtered studied items');
  await route('#/');await page.locator('[data-pengo-tip]').click();
  check(await page.locator('[data-pengo-bubble]').isVisible(),'tip opens');
  await page.locator('[data-pengo-tip]').click();check(await page.locator('[data-pengo-bubble]').isHidden(),'tip toggles closed');
  await page.locator('[data-pengo-tip]').click();await page.locator('[data-pengo-tip-close]').click();
  check(await page.locator('[data-pengo-bubble]').isHidden()&&await page.locator('[data-pengo-tip]').getAttribute('aria-expanded')==='false','tip has an explicit close button');
  await page.locator('[data-pengo-tip]').click();await page.keyboard.press('Escape');check(await page.locator('[data-pengo-bubble]').isHidden(),'Escape closes tip');
  const reminderBefore=await page.evaluate(()=>Reminders.read());
  await page.evaluate(()=>{window.requests=0;Notification.requestPermission=async()=>{requests++;return 'denied';};});
  await page.locator('[data-dismiss-reminder]').click();check(await page.locator('.reminder-nudge').count()===0,'reminder suggestion closes');
  assert.deepEqual(await page.evaluate(()=>Reminders.read()),reminderBefore);checks++;
  check(await page.evaluate(()=>requests)===0,'dismissal never asks for notification permission');
  await page.reload();await page.waitForSelector('.adventure-home');check(await page.locator('.reminder-nudge').count()===0,'dismissal survives reload');
  await page.evaluate(()=>importBackupText(JSON.stringify(store)));check(await page.locator('.reminder-nudge').count()===0,'backup import preserves device dismissal');
  await page.evaluate(()=>{Reminders.resetDevice();Reminders.write({enabled:true,time:'18:00'});render();});
  check(await page.locator('.reminder-nudge').count()===0,'enabled reminder hides Home suggestion');
  await page.evaluate(()=>{Reminders.disable();render();});check(await page.locator('.reminder-nudge').count()===1,'reset restores suggestion when reminders are off');
  // Quiz, normal learning and targeted challenges preserve one another.
  await route('#/learn?section=quiz&start=1&kind=kanji&size=3');const quiz=(await state()).practice.session;
  await route('#/flashcards?daily=1');const learning=(await state()).practice.session;
  await page.locator('#practiceReveal').click();await page.locator('#practicePause').click();await page.waitForSelector('#flashcardsForm');
  const focus=await page.evaluate(()=>{
   const today=Course.todayStr(),q=Dashboard.challenges({},today,5,'N5').find(q=>q.id==='focus');
   const records=q.kind==='kanji'?DB.levels.N5:q.kind==='vocab'?DB.vocab.N5:DB.grammar.N5;
   const item=records[0],id=q.kind==='kanji'?item.k:item.id;studyDay(today).practiced={[q.kind+':'+id]:true};save();return {kind:q.kind,key:q.kind+':'+id};
  });
  await route('#/');await page.locator('[data-challenge=focus] a').click();await page.waitForSelector('#practiceReveal');
  let s=await state(),challenge=s.practice.session;
  check(challenge.questions.length===2,'1/3 focus challenge opens exactly two cards');
  check(challenge.questions.every(q=>q.type===focus.kind&&q.type+':'+q.id!==focus.key),'challenge draws only uncounted items in its subject');
  check(s.practice.returnSession.id===learning.id&&s.practice.pausedSession.id===quiz.id,'challenge parks learning and preserves quiz');
  await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();
  await page.reload();await page.waitForSelector('#practiceReveal');s=await state();
  check(s.practice.session.id===challenge.id&&s.practice.session.cursor===1,'partial challenge resumes after reload');
  await page.evaluate(()=>importBackupText(JSON.stringify(store)));s=await state();
  check(s.practice.returnSession.id===learning.id,'parked learning survives backup import');
  await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();await page.waitForSelector('#recallContinue');
  s=await state();check(s.practice.session.id===learning.id&&s.practice.returnSession===null&&s.practice.pausedSession.id===quiz.id,'finishing challenge restores original deck and keeps quiz');
  await route('#/');check(await page.locator('[data-challenge=focus]').getAttribute('class')==='challenge-done','challenge completes at 3/3');
  check(await page.locator('[data-challenge=focus] a').count()===0,'complete challenge is status only');
  await page.locator('.hero-start').click();await page.waitForSelector('#recallDetails:not([hidden])');
  check((await state()).practice.session.id===learning.id,'hero continues original learning card');
  // Switching through quiz and another challenge keeps the original deck safe.
  await route('#/learn?section=quiz&resume=1');check((await state()).practice.session.id===quiz.id,'quiz can resume while learning is preserved');
  await route('#/flashcards?challenge=flip');challenge=(await state()).practice.session;
  check(challenge.questions.every(q=>q.type==='kanji'),'flip challenge chooses kanji only');
  await route('#/learn?section=quiz&resume=1');await route('#/flashcards?challenge=flip');
  check((await state()).practice.session.id===challenge.id,'targeted challenge resumes from paused slot instead of the quiz');
  await page.evaluate(()=>{store.practice.session.config.challengeDate=Course.addDays(Course.todayStr(),-1);save();});
  await route('#/');s=await state();check(s.practice.session.id===learning.id&&s.practice.returnSession===null&&s.practice.pausedSession.id===quiz.id,'expired challenge restores original learning and keeps quiz');
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;store.practice.returnSession=null;store.settings.dailyGoal=20;store.study.days={};save();});
  await route('#/flashcards?challenge=daily');check((await state()).practice.session.questions.length===10,'large daily challenge is bounded to ten cards');
  for(let i=0;i<10;i++){await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();}
  await page.waitForSelector('#recallContinue');check(await page.locator('#recallContinue').textContent()==='Continue challenge','unfinished large challenge offers its next deck');
  await page.locator('#recallContinue').click();await page.waitForSelector('#practiceReveal');
  check((await state()).practice.session.questions.length===10,'next challenge deck covers remaining ten');
  // Uniform recap keeps useful kanji detail in a single compact card.
  for(const type of ['kanji','vocab','grammar']){
   await page.evaluate(type=>{store.practice.session=null;store.practice.pausedSession=null;store.practice.returnSession=null;startPractice(document.querySelector('#view'),Practice.config({kind:type,lv:'N5',size:3,format:'recall'}));},type);
   await page.locator('#practiceReveal').click();
   check(await page.locator('#recallDetails > section.card.quiz-review').count()===1,type+' uses one uniform recap card');
   check(await page.locator('#recallDetails h3').textContent().then(s=>s.includes('Quick recap')),type+' uses shared recap heading');
   if(type==='kanji'){
    check(await page.locator('#recallDetails .learning-components,#recallDetails details').count()===0,'kanji recap omits nested component detail');
    check(await page.locator('#recallDetails .recap-shape').count()<=4,'kanji shapes stay compact');
    check(await page.locator('#recallDetails .recap-mnemonic').count()===1&&await page.locator('#recallDetails .quiz-review-list').count()===1,'kanji recap keeps memory aid and example words');
    await page.screenshot({path:artifacts+'/kanji-recap.png',fullPage:true});
   }
  }
  // Completed goal motivates another deck; active quiz does not hijack the hero.
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;store.practice.returnSession=null;store.course=Course.defaultCourse('N5');store.settings.dailyGoal=3;studyDay(Course.todayStr()).practiced={'kanji:日':true,'kanji:月':true,'kanji:火':true};save();});
  await route('#/');check(await page.locator('.hero-start').textContent().then(s=>s.includes('Learn more')),'goal-complete hero motivates more learning');
  check(await page.locator('.course-treasures').count()===0,'milestones removed from Home with a plan');
  await route('#/progress');check(await page.locator('.course-treasures .mile').count()>0,'milestones live in Progress');
  await route('#/learn?section=quiz&start=1');await route('#/');await page.locator('.hero-start').click();await page.waitForSelector('#practiceReveal');
  check((await state()).practice.session.config.format==='recall','hero always opens flashcards when a quiz is saved');
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:844});await page.evaluate(t=>{store.settings.theme=t;save();applyTheme();},theme);await route('#/');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' Home fits');
   check(await page.locator('.today-subject-row').evaluateAll(rows=>rows.every(row=>[...row.querySelectorAll('a > *')].every(el=>{const a=row.getBoundingClientRect(),r=el.getBoundingClientRect();return r.left>=a.left&&r.right<=a.right;}))),width+' '+theme+' list stays inside card');
   await page.screenshot({path:artifacts+'/home-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});
  }
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Home refinement: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
