/* Optional integration suite. Install Playwright separately; see docs/testing.md.
   Uses isolated browser contexts and never opens the user's Chrome profile. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.PENGO_TEST_URL || 'http://127.0.0.1:8000/';
const artifacts = process.env.PENGO_TEST_ARTIFACTS;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
(async()=>{
  const browser = await chromium.launch(process.env.PENGO_CHROME_CHANNEL ? {channel:process.env.PENGO_CHROME_CHANNEL,headless:true} : {headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage(), errors=[];
    page.setDefaultTimeout(10000);
    page.on('pageerror',e=>{errors.push(e.message); console.error('Page error:',e.message);});
    async function route(hash) { await page.goto(base+hash); await page.waitForFunction(()=>DB.loaded); await page.evaluate(hash=>go(hash),hash); await page.waitForSelector('#view > *'); }
    const state = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
    async function start({mode='smart',kind='mixed',lv='N5',size='3',format='quiz'}={}) {
      await route('#/practice?'+new URLSearchParams({mode,kind,lv,size}));
      await page.locator('.quiz-choice[data-quiz-kind='+kind+']').click();
    }
    async function answer(ok=true) {
      const s=await state(), q=s.practice.session.questions[s.practice.session.cursor];
      const id=ok?q.id:q.options.find(id=>id!==q.id);
      await page.locator('[data-answer]').filter({hasText:/.*/}).evaluateAll((buttons,id)=>buttons.find(b=>b.dataset.answer===id).click(),id);
      await page.waitForSelector('#practiceNext');
    }
    await route('#/settings'); await page.locator('#practiceGoal').selectOption('3');
    await page.reload(); await page.waitForSelector('#practiceGoal');
    check(await page.locator('#practiceGoal').inputValue()==='3','goal setting survives reload');
    await start();
    let s=await state(); const first=s.practice.session.questions[0];
    check(s.practice.session.questions.length===3,'three-question session is bounded');
    check(new Set(s.practice.session.questions.map(q=>q.type)).size===3,'mixed session covers all three skills');
    await answer(false); s=await state();
    check(s.practice.session.answers.length===1,'answer persisted immediately');
    check(s.practice.mistakes[first.type+':'+first.id],'wrong answer enters mistakes');
    const today=await page.evaluate(()=>Course.todayStr());
    check(s.study.days[today].attempts===1,'wrong answer counts as effort');
    check(await page.locator('#practiceNext').evaluate(el=>el===document.activeElement),'next control receives keyboard focus');
    await page.reload(); await page.waitForSelector('#practiceResume');
    await page.locator('#practiceResume').click();
    check((await state()).study.days[today].attempts===1,'resume does not grade again');
    check(await page.locator('[data-answer]:not(:disabled)').count()===0,'answered options remain disabled');
    await page.locator('#practiceNext').click();
    await answer(true); await page.locator('#practicePause').click();
    await page.waitForSelector('#practiceResume'); await page.locator('#practiceResume').click();
    check((await state()).practice.session.answers.length===2,'pause keeps answered position');
    await page.locator('#practiceNext').click(); await answer(true); await page.locator('#practiceNext').click();
    await page.getByRole('heading',{name:'Session complete',exact:true}).waitFor();
    s=await state();
    check(s.practice.session===null,'completed session clears saved slot');
    check(s.practice.history.length===1 && s.practice.history[0].score===2,'summary saved once');
    check(s.study.days[today].attempts===3,'three answers tracked');
    check(Object.keys(s.study.days[today].practiced).length===3,'goal counts unique items');
    check(s.practice.badges.includes('first-goal'),'goal achievement awarded');
    check((await page.locator('#view').textContent()).includes('good place to stop'),'summary offers stopping point');
    await start({mode:'mistakes'}); s=await state();
    check(s.practice.session.questions.length===1 && s.practice.session.questions[0].id===first.id,'mistakes isolates failed item');
    check(await page.locator('.quiz-review').count()===0,'quiz explanation hidden before answering');
    await answer(true);
    check(!(await state()).practice.mistakes[first.type+':'+first.id],'successful quiz answer clears mistake');
    check(Object.keys((await state()).study.days[today].practiced).length===3,'retry does not inflate daily goal');
    await page.locator('#practiceNext').click();
    await page.evaluate(()=>{
      const word=DB.vocab.N2[0];
      store.vSrs[word.id]={box:1,due:Date.now()-1};
      const future=DB.vocab.N5[0]; store.vSrs[future.id]={box:3,due:Date.now()+86400000}; save();
    });
    await start({mode:'due',kind:'vocab',lv:'N5'}); s=await state();
    check(s.practice.session.questions.every(q=>q.type==='vocab'),'due content filter respected');
    check(s.practice.session.questions.some(q=>q.lv==='N2'),'due covers all levels');
    check(await page.evaluate(()=>store.practice.session.questions.every(q=>practiceSrs(q).isDue)),'due excludes future and untouched cards');
    await answer(true); await page.locator('#practiceNext').click();
    await route('#/practice?mode=due&kind=vocab&start=1');
    check((await page.locator('#view').textContent()).includes('Nothing is due'),'empty due is truthful');
    // Every old quiz entry point uses the shared player and updates course days/SRS.
    await page.evaluate(()=>{store.course=Course.defaultCourse('N4');save();});
    await route('#/review?kind=grammar&lv=N4&size=3');
    check(await page.locator('.quiz-choice[data-quiz-kind=grammar]').isEnabled(),'legacy Review retains grammar access');
    check((await page.locator('.quiz-picker > .practice-heading').textContent()).includes('N4'),'legacy Review retains level choice');
    await page.locator('.quiz-choice[data-quiz-kind=grammar]').click();
    check(await page.evaluate(()=>store.practice.session.questions.every(q=>courseUnlocked().all.some(u=>u.type===q.type&&u.id===q.id))),'smart plan does not introduce locked material');
    await answer(false);
    check((await state()).course.studyDays.includes(today),'ordinary Review now records course activity');
    await page.evaluate(()=>{store.practice.session=null;save();});
    await route('#/course/quiz');
    await page.locator('.quiz-choice[data-quiz-kind=mixed]').click();
    check(await page.evaluate(()=>store.practice.session.questions.every(q=>courseUnlocked().all.some(u=>u.type===q.type&&u.id===q.id))),'plan quiz respects unlocking');
    check((await state()).course.quizzes===0,'plan completion counter does not advance on start');
    for(let i=0,n=(await state()).practice.session.questions.length;i<n;i++){await answer(true);await page.locator('#practiceNext').click();}
    check((await state()).course.quizzes===1 && (await state()).course.perfectQuiz,'plan completion and perfect flag recorded');
    // Standalone N5 quiz assertions run after leaving the N4 plan.
    await page.evaluate(()=>{store.course=null;save();const word=DB.vocab.N5[0];store.vocabTest=word.id;});
    await start({kind:'vocab',size:'10'});
    for(let i=0;i<10;i++){await answer(true);await page.locator('#practiceNext').click();}
    check((await state()).vQuizBest.N5===10,'ten-question level best score preserved');
    check((await page.locator('#view').textContent()).includes('Best on N5: 10 / 10'),'best score visible in summary');
    // Validate real grammar question choices, including sentence and blank variants.
    const grammar = await page.evaluate(()=>{
      const oldRandom=Math.random; let contextual=0,blank=0,valid=true;
      try {
        for(const lv of LEVELS) for(const record of (DB.grammar[lv]||[]).slice(0,30)) for(const random of [0.1,0.4,0.6,0.9]) {
          Math.random=()=>random;
          const q=courseBuildQuestion({type:'grammar',id:record.id},lv);
          if(!q)continue;
          const labels=q.opts.map(o=>courseQuizOptionLabel(q,o));
          valid=valid&&new Set(labels).size===labels.length&&q.opts.some(o=>o.id===record.id);
          if(q.variant===2) contextual++;
          if(q.variant===3) blank++;
        }
      }finally{Math.random=oldRandom;}
      return {valid,contextual,blank};
    });
    check(grammar.valid,'grammar choices have distinct labels and correct answer');
    check(grammar.contextual>0 && grammar.blank>0,'sentence translation and grammar blank practice retained');
    await route('#/');
    await page.setViewportSize({width:320,height:740});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home fits narrow mobile');
    await page.evaluate(()=>{store.settings.theme='dark';applyTheme();});
    if(artifacts)await page.screenshot({path:path.join(artifacts,'home-mobile-dark.png'),fullPage:true});
    await route('#/practice');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'practice form fits narrow mobile');
    await page.setViewportSize({width:1280,height:900});
    if(artifacts)await page.screenshot({path:path.join(artifacts,'practice-desktop.png'),fullPage:true});
    // Backups retain sessions/history and accept legacy stores without practice fields.
    const backup=await page.evaluate(()=>JSON.stringify(store));
    page.on('dialog',dialog=>dialog.accept());
    check(await page.evaluate(text=>importBackupText(text),backup),'new backup roundtrip works');
    check((await state()).practice.history.length===5,'backup retains completed practice history');
    check(await page.evaluate(()=>importBackupText(JSON.stringify({learned:{},settings:{theme:'light'}}))),'old backup imports');
    check((await state()).practice.history.length===0,'old backup supplies empty practice state');
    await page.evaluate(()=>{store.practice.session={version:1,id:'bad'};save();});
    await route('#/practice');
    check((await state()).practice.session===null,'malformed saved session discarded safely');
    // Existing learned items count once when reviewing on the migration date.
    await page.evaluate(()=>{
      const r=DB.levels.N5[0], day=Course.todayStr();
      importBackupText(JSON.stringify({learned:{[r.k]:Date.now()},study:{migratedLearned:true,days:{[day]:{learned:1,seconds:0}},loggedLearned:{['kanji:'+r.k]:true}}}));
      courseGrade('kanji',r.k,true);save();
    });
    check(await page.evaluate(()=>practiceStats().done)===1,'legacy today learned item is not double-counted by review');
    check(errors.length===0,'no page errors: '+errors.join(', '));
    await context.close();
    const fallback=await browser.newContext();const fallbackPage=await fallback.newPage();
    await fallbackPage.route('**/data/*.json',route=>route.abort());
    await fallbackPage.goto(base+'#/practice');await fallbackPage.waitForSelector('.quiz-picker');
    check(await fallbackPage.evaluate(()=>DB.source)==='bundle','practice works with offline fallback bundle');await fallback.close();
    const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked')};});
    const blockedPage=await blocked.newPage();await blockedPage.goto(base+'#/practice');await blockedPage.waitForSelector('.quiz-picker');
    check(await blockedPage.locator('.storage-notice').count()===1,'blocked persistence shows one actionable notice');await blocked.close();
    console.log('Browser practice:',checks,'checks passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
