/* Learning/quiz separation, detail return context and responsive card containment. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-learn-qa';
let checks=0;
function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  await route('#/learn');
  check(await page.locator('.learn-subjects .level-card').count()===3,'three subjects, no miniature Review tile');
  check(await page.locator('.quiz-picker').isVisible(),'simple quiz picker lives in Learn');
  check(await page.locator('.quiz-choices [data-quiz-kind]').count()===4,'four one-tap subject choices live in Learn');
  check(await page.locator('select[name=format]').count()===0,'quiz form does not mix learning cards with test formats');
  check(await page.locator('#sideNav a,#bottomNav a').filter({hasText:'Review'}).count()===0,'standalone Review navigation removed');
  check(await page.locator('#bottomNav a').count()===4,'mobile navigation has four tabs');
  await route('#/review?mode=mistakes&kind=vocab&lv=N4');await page.waitForSelector('#learnQuizzes');
  check((await page.evaluate(()=>location.hash)).startsWith('#/learn?section=quiz'),'old Review bookmarks resolve to Learn');
  check(await page.getByRole('heading',{name:'Revisit mistakes',exact:true}).isVisible()&&await page.locator('.quiz-choice[data-quiz-kind=vocab][data-quiz-mode=mistakes]').count()===1,'legacy review mode survives');
  await route('#/');
  check(await page.locator('.hero-start').textContent().then(s=>s.includes('learning')),'hero opens learning');
  check(await page.locator('.flashcard-entry').count()===0,'home uses the hero instead of a separate flashcard card');
  const today=await page.evaluate(()=>Course.todayStr());
  // Each subject returns to the same revealed card without awarding any result.
  for(const kind of ['kanji','vocab','grammar']){
   await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;save();});
   await route('#/flashcards?start=1&mode=explore&kind='+kind+'&size=3');await page.waitForSelector('#practiceReveal');
   await page.locator('#practiceReveal').click();
   const before=await state(),deck=before.practice.session;
   await page.getByRole('link',{name:'Explore full details',exact:true}).click();
   await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
   check((await page.evaluate(()=>location.hash)).includes('deck='+deck.id),kind+' details include deck context');
   await page.reload();await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
   check((await state()).practice.session.id===deck.id,kind+' details survive reload');
   // Following another item keeps the original card as the return destination.
   const href=await page.locator('#view a[href]').evaluateAll(a=>a.find(x=>/^#\/(k|v|g)\//.test(x.getAttribute('href')))?.getAttribute('href'));
   if(href){
    await page.locator('#view a[href]').evaluateAll((a,h)=>a.find(x=>x.getAttribute('href')===h).click(),href);
    await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
    check((await page.evaluate(()=>location.hash)).includes('deck='+deck.id),kind+' related detail keeps original deck context');
   }
   await page.getByRole('link',{name:'← Back to your learning card',exact:true}).click();await page.waitForSelector('#recallDetails:not([hidden])');
   check((await state()).practice.session.id===deck.id&&(await state()).practice.session.cursor===deck.cursor,kind+' returns to exact saved card');
   check(await page.locator('#practiceRatings').isVisible(),kind+' unrated reveal restores controls');
   assert.deepEqual((await state()).practice.session.answers,deck.answers);checks++;
   check(((await state()).study.days[today]||{}).attempts===((before.study.days[today]||{}).attempts),'detail navigation never grades '+kind);
   // Browser/native history back from details also returns to the card, not the hub.
   await page.getByRole('link',{name:'Explore full details',exact:true}).click();await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
   await page.evaluate(()=>Platform.handleBackPress());await page.waitForSelector('#recallDetails:not([hidden])');
   check((await state()).practice.session.id===deck.id,kind+' native Back restores the card');
  }
  // Existing due/mistake state is neither promoted nor cleared by learning.
  const first=await page.evaluate(()=>{
   const q=store.practice.session.questions[0];const map=q.type==='grammar'?store.gSrs:q.type==='vocab'?store.vSrs:store.srs;
   map[q.id]={box:2,due:Date.now()-1000,lastCorrectDay:'2026-01-01'};
   store.practice.mistakes[Practice.key(q)]={type:q.type,id:q.id,misses:2};save();return q;
  });
  const beforeLearning=await state();
  await page.locator('#practiceRemembered').click();
  const learned=await state();
  assert.deepEqual(learned.gSrs[first.id],beforeLearning.gSrs[first.id]);checks++;
  assert.deepEqual(learned.practice.mistakes,beforeLearning.practice.mistakes);checks++;
  check((learned.study.days[today].attempts||0)===(beforeLearning.study.days[today]?.attempts||0),'Got it does not affect test attempts');
  check((learned.study.days[today].correct||0)===(beforeLearning.study.days[today]?.correct||0),'Got it does not affect quiz accuracy');
  check(learned.gLearned[first.id],'Got it marks the item studied');
  check(learned.study.days[today].recalled[first.type+':'+first.id]&&learned.study.days[today].practiced[first.type+':'+first.id],'learning advances challenge and daily goal');
  check(learned.practice.session.cursor===1,'Got it advances directly to the next card');
  await page.locator('#practiceReveal').click();await page.locator('#practiceAgain').click();
  await page.getByRole('link',{name:'Explore full details',exact:true}).click();await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
  await page.getByRole('link',{name:'← Back to your learning card',exact:true}).click();await page.waitForSelector('#practiceNext:not([hidden])');
  check(await page.locator('#practiceRatings').isHidden(),'Still learning returns with feedback and next action');
  check(Object.keys((await state()).practice.mistakes).length===1,'Still learning does not add quiz mistakes');
  await page.locator('#practiceNext').click();await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();
  await page.getByRole('heading',{name:'Learning complete',exact:true}).waitFor();
  check(!(await page.locator('#view').textContent()).includes('correct'),'learning completion is not presented as a test score');
  await page.getByRole('link',{name:'Try a quiz',exact:true}).click();await page.waitForSelector('#quizChoices');
  check(await page.locator('#learnQuizzes h3').filter({hasText:'Last quiz'}).count()===0,'learning history is not displayed as last quiz');
  // Quiz progress and learning progress remain independently resumable.
  await page.locator('.quiz-choice[data-quiz-kind=kanji]').click();await page.waitForSelector('[data-answer]');
  await page.locator('[data-answer]').evaluateAll(b=>b.find(x=>x.dataset.answer===store.practice.session.questions[0].id).click());
  const quiz=(await state()).practice.session;
  await page.locator('#practicePause').click();await page.waitForSelector('#practiceResume');
  await page.getByRole('link',{name:'Start learning'}).click();await page.waitForSelector('#practiceReveal');
  await page.locator('#practiceReveal').click();
  const deck=(await state()).practice.session;
  await page.getByRole('link',{name:'Explore full details',exact:true}).click();await page.getByRole('link',{name:'← Back to your learning card',exact:true}).waitFor();
  const detailHash=await page.evaluate(()=>location.hash);
  await route('#/learn?section=quiz');await page.locator('#practiceResume').click();await page.waitForSelector('[data-answer]');
  check((await state()).practice.session.id===quiz.id,'merged Learn resumes the quiz with its answers');
  await route(detailHash);await page.getByRole('link',{name:'← Back to your learning card',exact:true}).click();await page.waitForSelector('#recallDetails:not([hidden])');
  check((await state()).practice.session.id===deck.id&&(await state()).practice.pausedSession.id===quiz.id,'detail back restores even a paused learning deck and retains quiz');
  await route('#/learn?section=quiz');page.on('dialog',d=>d.accept());
  await page.locator('#practiceReplace').click();await page.locator('.quiz-choice[data-quiz-kind=kanji]').click();await page.waitForSelector('[data-answer]');
  check((await state()).practice.session.id!==quiz.id,'replacing a paused quiz creates a new quiz');
  check((await state()).practice.pausedSession.id===deck.id,'replacing a paused quiz retains the learning deck');
  await route('#/k/日?deck=missing');
  check(await page.getByRole('link',{name:'← Back to your learning card',exact:true}).count()===0,'stale deck links safely use normal browse navigation');
  // A plan learning deck must never award quiz-completion or perfect-quiz flags.
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;store.course=Course.defaultCourse('N5');save();});
  await route('#/flashcards?start=1&mode=plan&kind=mixed&size=3');await page.waitForSelector('#practiceReveal');
  while((await state()).practice.session){
   await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();
  }
  check((await state()).course.quizzes===0&&!(await state()).course.perfectQuiz,'plan learning completion never masquerades as a perfect quiz');
  await page.evaluate(()=>{store.course=null;save();});
  // Element bounds (not only overall page width) catch counts escaping their cards.
  for(const width of [320,390,768,1024,1440])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:900});await page.evaluate(t=>{store.settings.theme=t;save();applyTheme();},theme);
   await route('#/learn?lv=N1');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' Learn fits viewport');
   check(await page.locator('.learn-subjects .level-card').evaluateAll(cards=>cards.every(card=>{
    const outer=card.getBoundingClientRect();return [...card.querySelectorAll('.lvl>*')].every(el=>{const r=el.getBoundingClientRect();return r.left>=outer.left&&r.right<=outer.right&&r.top>=outer.top&&r.bottom<=outer.bottom;});
   })),width+' '+theme+' title/count stay inside each card');
   await page.screenshot({path:artifacts+'/learn-'+width+'-'+theme+'.png',fullPage:true});
  }
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Learn improvements: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
