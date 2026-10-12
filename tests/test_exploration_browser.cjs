/* All-level discovery stays read-only outside the plan; contextual navigation and motion. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-exploration-qa';
let checks=0;
function check(v,label){assert.ok(v,label);checks++;}
// Visible app time accrues independently of discovery; compare actual learning state.
function learningState(s){
 const copy=structuredClone(s);
 for(const [date,day] of Object.entries(copy.study.days)){
  delete day.seconds;if(day.learned===0)delete day.learned;
  if(Object.keys(day).length===0)delete copy.study.days[date];
 }
 return copy;
}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:process.env.PENGO_CHROME_CHANNEL||'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  await route('#/');
  await page.evaluate(()=>{store.course=Course.defaultCourse('N5');save();render();});
  const targets=await page.evaluate(()=>({
   kanji:DB.levels.N1.find(r=>!inStudyLevel('kanji',r.k)),vocab:DB.vocab.N1[0],grammar:DB.grammar.N1[0]
  }));
  const before=await state();
  for(const [kind,prefix,key] of [['kanji','k','k'],['vocab','v','word'],['grammar','g','point']]){
   const id=kind==='kanji'?targets[kind].k:targets[kind].id;
   if(kind==='vocab'){
    await route('#/search');await page.locator('#sq').fill(targets[kind][key]);
    const link=page.locator('#sRes a[href="#/'+prefix+'/'+encodeURIComponent(id)+'"]');await link.waitFor();
    check(await page.locator('#sq').getAttribute('placeholder')==='Search any word','dictionary search labels its scope');
    await link.click();
   }else await route('#/'+prefix+'/'+encodeURIComponent(id));
   await page.waitForSelector('.browse-only');
   check(await page.locator('.detail-head').isVisible(),kind+' outside the plan opens');
   check(await page.locator('.action-row,.note').count()===0,kind+' has no writable study controls');
   if(kind==='vocab'){
    await page.locator('.page-back').click();await page.waitForSelector('#sq');
    check(await page.locator('#sq').inputValue()===targets[kind][key],'dictionary Back restores query');
   }
  }
  assert.deepEqual(learningState(await state()),learningState(before));checks++;
  await route('#/search');await page.locator('#sq').fill('to read');await page.waitForTimeout(300);await page.reload();await page.waitForSelector('#sq');check(await page.locator('#sq').inputValue()==='to read','multi-word search survives reload');
  await page.evaluate(t=>{toggleLearned(t.kanji.k);toggleFav(t.kanji.k);toggleVLearned(t.vocab.id);toggleVFav(t.vocab.id);toggleGLearned(t.grammar.id);toggleGFav(t.grammar.id);},targets);
  assert.deepEqual(learningState(await state()),learningState(before));checks++;
  for(const [kind,input] of [['kanji','bq'],['vocab','vq'],['grammar','gq']]){
   await route('#/learn');await page.locator('.learn-subjects a[href="#/'+kind+'/N5"]').click();await page.waitForSelector('#'+input);
   check((await page.locator('#'+input).getAttribute('placeholder')).includes('N5'),kind+' Learn search labels its scope');
   await page.locator('#'+input).fill('water');await page.waitForTimeout(220);
   check(await page.locator('#'+input).evaluate(el=>document.activeElement===el),kind+' scoped search keeps focus');
   await page.locator('.page-back').click();await page.waitForSelector('.learn-subjects');
   check(await page.locator('.learn-subjects').isVisible(),kind+' browser Back restores Learn');
  }
  const related=await page.evaluate(()=>DB.vocab.N5.find(v=>kanjiCharsOf(v).some(c=>!inStudyLevel('kanji',c))));
  check(!!related,'fixture includes a word with kanji outside its level');
  await route('#/v/'+related.id);
  const ch=await page.evaluate(v=>kanjiCharsOf(v).find(c=>!inStudyLevel('kanji',c)),related);
  await page.locator('a[href="#/k/'+encodeURIComponent(ch)+'"]').click();await page.waitForSelector('.browse-only');
  await page.reload();await page.waitForSelector('.page-back');await page.locator('.page-back').click();await page.waitForSelector('#vLearn');
  check(await page.locator('.vocab-hero').textContent()===related.word,'related-kanji Back returns to originating word after reload');
  // Direct opens fall back into the app without leaving the document.
  const direct=await context.newPage();await direct.goto(base+'#/g/'+targets.grammar.id);await direct.waitForSelector('.browse-only');
  await direct.locator('.page-back').click();await direct.waitForSelector('#gq');
  check(direct.url().startsWith(base),'direct detail Back stays in the app');await direct.close();
  await route('#/search?q=a');
  check(await page.locator('#sRes a[href^="#/k/"],#sRes a[href^="#/g/"]').count()===0,'global search omits kanji and grammar');
  check(await page.locator('#sRes .vcard').count()===120,'global vocabulary results remain capped');
  // Ordinary and due practice still cannot select other levels.
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;save();});
  await route('#/flashcards?start=1&mode=explore&size=3&kind=kanji&lv=N1');await page.waitForSelector('#practiceReveal');
  check((await state()).practice.session.questions.every(q=>q.lv==='N5'),'exploration never expands learning syllabus');
  check(await page.locator('#recallFlipper').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)>0),'normal motion rotates the card');
  await page.locator('#practiceReveal').click();await page.waitForTimeout(280);
  const halfway=await page.locator('#recallFlipper').evaluate(el=>getComputedStyle(el).transform);
  check(halfway!=='none'&&!halfway.startsWith('matrix('),'flip has an intermediate 3D rotation');
  await page.waitForTimeout(350);
  await page.screenshot({path:artifacts+'/flashcard-back.png'});
  check(await page.locator('#recallHide').count()===0,'extra flip-back button is gone');
  check(await page.locator('#recallBack').getAttribute('aria-hidden')==='false','answer is accessible');
  await page.locator('#recallBack').click();await page.waitForTimeout(600);
  check(await page.locator('#recallDetails').isHidden()&&await page.locator('#practiceRatings').isHidden(),'tapping answer flips front and hides ratings');
  check((await state()).practice.session.answers.length===0,'flipping does not mark learning');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#practiceReveal').focus();await page.keyboard.press('Enter');
  check(await page.locator('#recallFlipper').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s','reduced motion skips card rotation');
  await page.locator('#recallBack').focus();await page.keyboard.press('Space');
  check(await page.locator('#recallDetails').isHidden(),'keyboard can flip back');
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:844});await page.evaluate(t=>{store.settings.theme=t;applyTheme();},theme);await route('#/');
   const initial=await state();
   check(await page.locator('#topSearchInput').evaluate(el=>{if(!el.getClientRects().length)return true;const s=getComputedStyle(el),canvas=document.createElement('canvas'),c=canvas.getContext('2d');c.font=s.font;return c.measureText(el.placeholder).width<=el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-24;}),'global placeholder fits '+width+' '+theme);
   check(await page.locator('#dailyWordContent').isHidden(),'word starts as a discovery '+width+' '+theme);
   check(await page.locator('.daily-word-pengo').evaluate(el=>el.complete&&el.naturalWidth>0),'complete mascot loads '+width+' '+theme);
   check(await page.locator('.daily-word-pengo').evaluate(el=>getComputedStyle(el).animationName)==='none','reduced motion disables word mascot animation');
   await page.locator('#dailyWordReveal').click();
   check(await page.locator('#dailyWordContent h2').textContent().then(s=>!!s.trim()),'reveal shows word '+width+' '+theme);
   check(await page.locator('#dailyWordContent p').last().textContent().then(s=>!!s.trim()),'reveal shows meaning '+width+' '+theme);
   check(await page.locator('#dailyWordContent p').last().evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('#bottomNav').getBoundingClientRect();return r.top>=0&&r.bottom<=Math.min(innerHeight,nav.height?nav.top:innerHeight);}),'word meaning scrolls into view '+width+' '+theme);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Home reveal fits '+width+' '+theme);
   assert.deepEqual(learningState(await state()),learningState(initial));checks++;
   await page.screenshot({path:artifacts+'/home-'+width+'-'+theme+'.png',fullPage:true});
   await page.locator('#dailyWordContent a').click();await page.waitForSelector('#vLearn');await page.locator('.page-back').click();await page.waitForSelector('#dailyWordReveal');
   check(await page.locator('.adventure-home').isVisible(),'word Back restores Home');
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await route('#/');
  check(await page.locator('.daily-word-pengo').evaluate(el=>getComputedStyle(el).animationIterationCount)==='3','word invitation animation ends after three cycles');
  await route('#/settings');check(await page.locator('.settings-welcome').count()===0&&!(await page.locator('#view').textContent()).includes('Your little corner'),'settings welcome card removed');
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Exploration UI: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
