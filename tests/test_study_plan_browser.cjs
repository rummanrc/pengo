/* Restored plan journey, persistence, level isolation and theme/layout regressions. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS;
let checks=0;
function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PENGO_CHROME_CHANNEL?{channel:process.env.PENGO_CHROME_CHANNEL}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(hash=>go(hash),hash);}
  await route('#/');await page.locator('.adventure-level').first().click();await page.waitForSelector('#planStart');
  check(await page.locator('[data-lv][aria-pressed=true]').getAttribute('data-lv')==='N5','new learner begins at N5');
  check(await page.locator('[data-pace][aria-pressed=true]').getAttribute('data-pace')==='5','five is the gentle suggestion');
  await page.locator('[data-lv=N4]').click();await page.locator('[data-pace="3"]').click();
  check((await page.locator('#planPreview').textContent()).includes('N4 · 3'),'preview reflects both choices');
  await page.locator('#planStart').click();await page.waitForSelector('.adventure-home');
  check(await page.evaluate(()=>store.course.target==='N4'&&store.course.dailyNew===3&&store.settings.dailyGoal===3),'plan and matching daily goal save');
  await page.reload();await page.waitForFunction(()=>DB.loaded);
  check(await page.evaluate(()=>store.course.target==='N4'&&store.course.dailyNew===3),'plan survives reload');
  await route('#/learn?lv=N1');
  check(await page.locator('[data-lv]').count()===0&&await page.locator('.study-focus strong').textContent()==='Your N4 adventure'&&await page.locator('.learn-subjects a').evaluateAll(a=>a.every(el=>el.getAttribute('href').endsWith('/N4'))),'learn ignores stale level URLs without a redundant level badge');
  for(const [routeName,selector] of [['kanji','.kcard .badge'],['vocab','.vcard .badge'],['grammar','.gcard .badge']]){
   await route('#/'+routeName+'/N1');
   check(await page.locator('[data-lv]').count()===1,routeName+' exposes only the plan level');
   const levels=await page.locator(selector).allTextContents();
   check(levels.length>0&&levels.every(l=>l==='N4'),routeName+' list contains only N4');
  }
  const detailIds=await page.evaluate(()=>({kanji:DB.levels.N1.find(r=>!inStudyLevel('kanji',r.k)).k,vocab:DB.vocab.N1[0].id,grammar:DB.grammar.N1[0].id}));
  for(const [kind,routeName] of [['kanji','k'],['vocab','v'],['grammar','g']]){
   await route('#/'+routeName+'/'+encodeURIComponent(detailIds[kind]));
   check(await page.locator('.detail-head').count()===1&&await page.locator('.browse-only').count()===1&&await page.locator('.action-row,.note').count()===0,'outside '+kind+' detail opens read-only');
  }
  const overlap=await page.evaluate(()=>DB.levels.N4.find(r=>DB.byChar[r.k].level!=='N4').k);
  await route('#/k/'+encodeURIComponent(overlap));
  check((await page.locator('.detail-title .badge').first().textContent()).includes('N4'),'overlapping kanji details retain chosen level');
  await route('#/search?q=water');
  const searchLevels=await page.locator('#sRes .kcard .badge').allTextContents();
  check(searchLevels.length>0&&searchLevels.some(l=>l!=='N4'),'global search includes other levels');
  await page.evaluate(()=>{
   store.vSrs[DB.vocab.N4[0].id]={box:1,due:Date.now()-100};
   store.vSrs[DB.vocab.N2[0].id]={box:1,due:Date.now()-200};
   store.practice.mistakes['vocab:'+DB.vocab.N2[0].id]={type:'vocab',id:DB.vocab.N2[0].id};save();
  });
  await route('#/practice?mode=due&kind=vocab&lv=N2&start=1');
  check(await page.evaluate(()=>store.practice.session.questions.every(q=>q.lv==='N4')),'due sessions stay at target despite older reviews');
  await page.evaluate(()=>{store.practice.session=null;save();});
  await route('#/practice?mode=mistakes');
  check(await page.evaluate(()=>practicePool(Practice.config({mode:'mistakes',lv:'N2'})).every(q=>q.lv==='N4')),'mistakes pool stays at target');
  check((await page.locator('.quiz-picker > .practice-heading').textContent()).includes('N4')&&await page.locator('[name=lv]').count()===0,'quiz level follows saved plan without a selector');
  for(const mode of ['smart','explore','plan']){
   await page.evaluate(()=>{store.practice.session=null;save();});
   await route('#/practice?mode='+mode+'&format=recall&lv=N1&start=1');
   check(await page.evaluate(()=>store.practice.session.questions.every(q=>q.lv==='N4')),mode+' session respects target');
  }
  const learned=await page.evaluate(()=>{const k=DB.levels.N4[0].k;store.learned[k]=Date.now();store.course.unlockedDay=2;save();return k;});
  await route('#/settings?section=plan');await page.locator('#studyPlanSettings a.btn').click();await page.waitForSelector('#planStart');
  check(await page.locator('#paceCustom').inputValue()==='3','editing preserves chosen pace');
  await page.locator('#paceCustom').fill('7');await page.locator('#planStart').click();await page.waitForSelector('.adventure-home');
  check(await page.evaluate(()=>store.course.dailyNew===7&&store.course.unlockedDay===2),'custom pace retains current unlock position');
  await route('#/course/setup');await page.locator('#paceCustom').fill('0');await page.locator('#planStart').click();
  check(await page.evaluate(()=>store.course.dailyNew===7),'invalid pace cannot save');
  await page.locator('[data-lv=N3]').click();await page.locator('[data-pace="5"]').click();await page.locator('#planStart').click();await page.waitForSelector('.adventure-home');
  check(await page.evaluate(k=>store.course.target==='N3'&&store.course.unlockedDay===1&&!!store.learned[k],learned),'new destination resets batches and preserves learned data');
  check(await page.evaluate(()=>store.practice.session===null),'level change discards an unfinished other-level session');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{store.settings.theme=theme;save();applyTheme();},theme);
   await route('#/progress?level=N1');
   check(await page.locator('.pg-wrap').evaluate(el=>getComputedStyle(el).backgroundColor===getComputedStyle(document.body).backgroundColor),theme+' progress background matches app');
   check((await page.locator('.pg-hero h2').textContent()).includes('N3'),theme+' progress focuses on target');
   const centers=await page.locator('.study-summary-icon').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return r.y+r.height/2;}));
   check(Math.max(...centers)-Math.min(...centers)<1,theme+' bottom summary icons align');
   check(await page.locator('.study-summary-icon svg').count()===3,'all summary icons use SVG');
   if(artifacts)await page.evaluate(()=>window.scrollTo(0,0));
   if(artifacts)await page.screenshot({path:path.join(artifacts,'progress-'+theme+'.png'),fullPage:true});
   await route('#/settings');
   check(await page.locator('#sWipe').evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor),theme+' erase label remains visible');
   await page.locator('#sWipe').click();await page.locator('#sWipeCancel').click();
   check(await page.evaluate(k=>!!store.learned[k],learned),'cancel erase keeps data');
   await page.locator('#sAuto').uncheck();check(await page.evaluate(()=>!store.settings.autoplay),'stroke-order setting saves');
   if(artifacts)await page.evaluate(()=>window.scrollTo(0,0));
   if(artifacts)await page.screenshot({path:path.join(artifacts,'settings-'+theme+'.png'),fullPage:true});
   await route('#/course/setup');if(artifacts)await page.evaluate(()=>window.scrollTo(0,0));
   if(artifacts)await page.screenshot({path:path.join(artifacts,'plan-'+theme+'.png'),fullPage:true});
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const hash of ['#/course/setup','#/settings','#/progress']){
     await route(hash);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+width+' '+hash+' fits');
    }
   }
   await page.setViewportSize({width:390,height:844});
  }
  page.on('dialog',d=>d.accept());await route('#/course/reset');await page.waitForSelector('.choose-level');
  check(await page.evaluate(k=>store.course===null&&!!store.learned[k],learned),'ending plan preserves progress');
  await route('#/practice');check(await page.locator('[data-lv]').count()===5,'ending plan restores free browsing');
  check(await page.evaluate(()=>practicePool(Practice.config({mode:'due'})).some(q=>q.lv==='N2')),'older-level reviews remain stored and accessible after plan ends');
  check(errors.length===0,'no browser errors: '+errors.join(', '));
  await context.close();
  const intro=await browser.newContext();const introPage=await intro.newPage();
  await introPage.goto(base+'?onboarding=1');await introPage.locator('.ob-skip').click();await introPage.waitForSelector('#planStart');
  check(await introPage.locator('.plan-setup').count()===1,'first intro leads into study plan');await intro.close();
  console.log('Study plan/settings browser:',checks,'checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
