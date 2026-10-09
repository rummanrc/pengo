/* Daily learning entry, compact mobile cards, and date-scoped item lists. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-daily-learning-qa';
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:360,height:640},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  await page.goto(base+'?onboarding=1');await page.waitForSelector('.ob-root');
  check(await page.locator('.ob-brand').count()===1&&await page.locator('.ob-title').textContent().then(s=>s.includes('JLPT')),'intro combines brand and JLPT pitch');
  check(await page.locator('.ob-dots i').count()===2,'intro has two pages');
  check(!(await page.locator('.ob-root').textContent()).includes('Small steps. Big Japanese'),'old tagline removed');
  await page.locator('.ob-cta').click();check(await page.locator('.ob-feat').count()===5,'second page shows features');
  await page.locator('.ob-back').click();check(await page.locator('.ob-brand').count()===1,'intro back returns to combined page');
  await page.locator('.ob-cta').click();await page.locator('.ob-cta').click();check(await page.locator('.ob-root').count()===0,'intro finishes after two pages');
  await route('#/');
  check(await page.locator('.daily-challenges a,.daily-challenges button').count()===0,'challenges are noninteractive');
  check(!(await page.locator('.daily-challenges').textContent()).includes('Pick what'),'challenge instruction removed');
  check(await page.locator('.learning-path').count()===0,'learning trail removed');
  check(!(await page.locator('.practice-daily').textContent()).includes('TODAY’S LITTLE WIN'),'daily practice eyebrow removed');
  check(await page.locator('.today-summary,.today-review,.today-subject small').count()===0,'daily overview has no footer or batch copy');
  await page.getByRole('link',{name:'View items',exact:true}).click();await page.waitForSelector('.today-items');
  check(await page.locator('.today-items .course-item').count()===0,'empty day shows no invented items');
  check(await page.locator('[data-answer]').count()===0,'today list never launches a quiz');
  // Exact remaining goal, including a one-card deck, and quiz preservation.
  await page.evaluate(()=>{store.course=null;store.settings.dailyGoal=5;const d=studyDay(Course.todayStr());d.practiced={};DB.levels.N5.slice(0,4).forEach(r=>d.practiced['kanji:'+r.k]=true);save();});
  await route('#/learn?section=quiz&start=1&kind=kanji&size=3');const quiz=(await state()).practice.session;
  await route('#/');await page.getByRole('link',{name:'Start learning'}).click();await page.waitForSelector('#practiceReveal');
  let deck=(await state()).practice.session;
  check(deck.questions.length===1,'daily entry fills exactly one remaining goal item');
  check((await state()).practice.pausedSession.id===quiz.id,'daily learning preserves saved quiz');
  check(await page.locator('#flashcardsForm').count()===0,'home opens learning directly');
  await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();await page.waitForSelector('#recallContinue');
  check((await state()).practice.session===null,'Got it on last card completes deck directly');
  await page.locator('#recallContinue').click();await page.waitForSelector('#practiceReveal');
  check((await state()).practice.session.questions.length===5,'goal complete offers another deck');
  check((await state()).practice.session.questions.every(q=>!deck.questions.some(x=>x.type===q.type&&x.id===q.id)),'extra deck avoids today’s rated items');
  // Pending plan items drive the deck, even when practice goal is already met.
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;store.course=Course.defaultCourse('N5');const b=courseTodaysBatch();b.items.slice(0,-2).forEach(it=>courseMarkStudied(it.type,it.id));save();});
  const pending=await page.evaluate(()=>courseTodaysBatch().items.filter(it=>!courseIsLearned(it.type,it.id)).map(Practice.key));
  await route('#/flashcards?daily=1');await page.waitForSelector('#practiceReveal');deck=(await state()).practice.session;
  check(deck.questions.length===pending.length,'deck length matches remaining plan items');
  check(deck.questions.every(q=>pending.includes(q.type+':'+q.id)),'plan deck uses assigned pending items');
  await page.reload();await page.waitForSelector('#practiceReveal');check((await state()).practice.session.id===deck.id,'daily deck resumes after reload');
  await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();
  check((await state()).practice.session.cursor===1,'Got it advances without Next card');
  check(await page.locator('#practiceReveal').isVisible()&&await page.locator('#practiceNext').isHidden(),'next card starts on front');
  await route('#/today');check(await page.locator('.today-items .course-item').count()>0,'today list includes recorded study');
  await page.locator('[data-today-kind=kanji]').click();await page.waitForFunction(()=>document.querySelectorAll('.today-items').length===1);check(await page.locator('.today-items').count()===1,'subject filter shows one group');
  await page.reload();await page.waitForSelector('[data-today-subject=kanji]');check(await page.locator('[data-today-subject=kanji]').count()===1,'today filter survives reload');
  const row=page.locator('.today-items .course-item a').first();if(await row.count()){await row.click();await page.waitForSelector('#dLearn');check(await page.locator('#dLearn').count()===1,'listed kanji opens details');}
  await route('#/k/日');check(!(await page.locator('#view').textContent()).includes('Grammar with this kanji'),'kanji grammar card removed');
  // Deterministic kanji/vocab/grammar examples prove meaning, readings and furigana.
  for(const type of ['kanji','vocab','grammar']){
   await page.evaluate(type=>{store.course=null;store.practice.session=null;store.practice.pausedSession=null;const list=type==='kanji'?DB.levels.N5:type==='vocab'?DB.vocab.N5:DB.grammar.N5;const item=list.find(r=>(r.sentences||r.examples||[]).some(s=>/<ruby[\s>]/.test(s.furi||'')&&/[A-Za-z]/.test(s.en||'')));const id=type==='kanji'?item.k:item.id;const s={version:1,id:'fit-'+type,config:Practice.config({kind:type,lv:'N5',size:3,format:'recall'}),questions:[{type,id,lv:'N5',variant:0,options:[]}],cursor:0,answers:[]};store.practice.session=s;save();go('#/flashcards?resume=1');},type);
   await page.waitForSelector('#practiceReveal');await page.locator('#practiceReveal').click();
   check(await page.locator('.recall-meaning h2').textContent().then(s=>s.trim().length>0),type+' answer displays meaning');
   check(await page.locator('#recallDetails ruby rt').count()>0,type+' example displays furigana');
   if(type==='kanji')check(await page.locator('.recall-readings').textContent().then(s=>s.includes('音読み（おんよみ）')&&s.includes('訓読み（くんよみ）')),'readings use Japanese onyomi/kunyomi labels');
   for(const [width,height] of [[320,568],[360,640],[390,844],[768,900],[1280,900]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    for(const theme of ['light','dark']){
     await page.evaluate(t=>{store.settings.theme=t;applyTheme();},theme);
     check(await page.locator('#practiceRemembered').evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('#bottomNav').getBoundingClientRect();return r.top>=0&&r.bottom<=Math.min(innerHeight,nav.height?nav.top:innerHeight);}),type+' Got it visible at '+width+'x'+height+' '+theme);
     check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),type+' card fits '+width+' '+theme);
     if(width===360)await page.screenshot({path:artifacts+'/'+type+'-'+theme+'.png'});
    }
   }
  }
  // Today stays date-scoped and deduplicates repeat attempts.
  await page.evaluate(()=>{store.study.days={};const today=Course.todayStr();studyDay(today).practiced={'kanji:日':true};studyDay(Course.addDays(today,-1)).practiced={'kanji:月':true};save();});
  await route('#/today');check(await page.locator('.today-items .course-item').count()===1,'list excludes yesterday and deduplicates items');
  check(errors.length===0,'no browser errors: '+errors.join('; '));
  console.log('Daily learning: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
