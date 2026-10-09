/* Discoverability and safe switching between a saved quiz and flashcard deck. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-flashcards-qa';
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  await route('#/practice?start=1&size=5&kind=kanji&format=quiz');
  await page.locator('[data-answer]').evaluateAll(buttons=>buttons.find(b=>b.dataset.answer===store.practice.session.questions[0].id).click());
  const quiz=(await state()).practice.session,today=await page.evaluate(()=>Course.todayStr());
  await route('#/review');
  check(await page.getByRole('link',{name:'Start learning'}).isEnabled(),'learning stays enabled with a saved quiz');
  check(await page.getByRole('heading',{name:'Check your progress',exact:true}).isVisible(),'legacy Review opens the merged Learn quiz controls');
  await page.getByRole('link',{name:'Start learning'}).click();await page.waitForSelector('#practiceReveal');
  check(await page.locator('#flashcardsForm').count()===0,'daily learning skips setup');
  let s=await state(),deck=s.practice.session;
  check(s.practice.session.config.format==='recall','flashcard intent opens cards rather than saved quiz');
  check(s.practice.session.config.kind==='mixed','daily deck includes the available subjects');
  assert.deepEqual(s.practice.pausedSession,quiz);checks++;
  check(s.study.days[today].attempts===1,'switching does not grade or discard quiz progress');
  await page.locator('#practiceReveal').click();
  check(await page.locator('#recallDetails').isVisible(),'tap reveals details');
  await page.locator('#practiceAgain').click();
  check((await state()).study.days[today].attempts===1,'learning confidence does not record a quiz attempt');
  await page.locator('#practicePause').click();await page.waitForSelector('#flashcardsStart');
  check(await page.locator('#flashcardsStart').textContent()==='Continue learning','paused deck has a clearly labeled resume control');
  await page.locator('#flashcardsQuiz').click();await page.waitForSelector('[data-answer]');
  s=await state();
  check(s.practice.session.id===quiz.id&&s.practice.session.answers.length===1,'quiz returns at its saved answered position');
  check(s.practice.pausedSession.id===deck.id&&s.practice.pausedSession.answers.length===1,'card deck is preserved during quiz resume');
  await route('#/');
  check(await page.getByRole('link',{name:'Start learning'}).isVisible(),'Home offers an explicit flashcard entry');
  check(await page.locator('.daily-challenges a').count()===0,'challenges only show progress');
  await page.getByRole('link',{name:'Start learning'}).click();await page.waitForSelector('#practiceNext');
  s=await state();
  check(s.practice.session.id===deck.id&&s.practice.session.config.format==='recall','daily kanji challenge restores cards instead of quiz');
  check(s.practice.pausedSession.id===quiz.id,'daily challenge retains saved quiz');
  await page.reload();await page.waitForSelector('#practiceNext');
  s=await state();check(s.practice.session.id===deck.id&&s.practice.pausedSession.id===quiz.id,'both formats survive reload');
  check(s.study.days[today].attempts===1,'reload never double grades');
  await page.evaluate(()=>{const backup=JSON.stringify(store);importBackupText(backup);});
  check((await state()).practice.pausedSession.id===quiz.id,'backup import retains paused quiz');
  while((await state()).practice.session){
   if(await page.locator('#practiceNext').isVisible()){await page.locator('#practiceNext').click();}
   else{await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();}
  }
  check((await state()).practice.pausedSession.id===quiz.id,'finishing cards keeps quiz available');
  await route('#/review');await page.locator('#practiceResume').click();
  check((await state()).practice.session.id===quiz.id,'Review resumes paused quiz after cards complete');
  await route('#/learn');check(await page.getByRole('link',{name:'Start learning'}).isVisible(),'Learn also exposes flashcards');
  await route('#/flashcards?choose=1');await page.waitForSelector('#flashcardsForm');
  await page.locator('[name=kind]').selectOption('vocab');await page.locator('#flashcardsStart').click();
  check((await state()).practice.session.questions.every(q=>q.type==='vocab'),'hub can start vocabulary cards');
  await page.locator('#practiceReveal').click();check(await page.locator('#recallBack').isVisible(),'vocabulary card flips');
  await page.locator('#practicePause').click();
  await page.evaluate(()=>{store.course=Course.defaultCourse('N4');save();});
  await route('#/flashcards?choose=1');
  check(await page.locator('[name=lv] option').count()===1&&await page.locator('[name=lv]').inputValue()==='N4','flashcards honor chosen study-plan level');
  check((await state()).practice.session===null&&(await state()).practice.pausedSession===null,'changing plan invalidates both old-level sessions');
  await page.locator('[name=kind]').selectOption('grammar');await page.locator('#flashcardsStart').click();
  check((await state()).practice.session.questions.every(q=>q.type==='grammar'&&q.lv==='N4'),'grammar cards honor the active level');
  await page.locator('#practicePause').click();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   await route('#/');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Home entry fits '+width+'px');
   await page.screenshot({path:path.join(artifacts,'home-'+width+'.png'),fullPage:true});
   await route('#/flashcards?choose=1');await page.waitForSelector('#flashcardsForm');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'flashcard hub fits '+width+'px');
   await page.screenshot({path:path.join(artifacts,'hub-'+width+'.png')});
  }
  check(errors.length===0,'no runtime errors: '+errors.join(';'));
  console.log('Flashcard access: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
