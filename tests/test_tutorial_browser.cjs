/* Real tutorial taps, preview isolation, replay, interruption, and responsive placement. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-tutorial-qa';
let checks=0;function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  async function step(n){await page.waitForFunction(n=>{const e=document.querySelector('.tour-heading .eyebrow');return e&&e.textContent.includes('· '+n+' /');},n);}
  async function tap(){
   const next=page.locator('.tour-next');if(await next.count()){await next.click();return;}
   const point=await page.evaluate(()=>{
    const target=document.querySelector('.tour-target'),ring=document.querySelector('.tour-ring').getBoundingClientRect();
    const candidates=target.querySelector('[data-answer]')?[...target.querySelectorAll('[data-answer]')]:[target];
    for(const el of candidates){
     const r=el.getBoundingClientRect(),left=Math.max(r.left,ring.left+4),right=Math.min(r.right,ring.right-4),top=Math.max(r.top,ring.top+4),bottom=Math.min(r.bottom,ring.bottom-4);
     if(right<=left||bottom<=top)continue;
     const x=(left+right)/2,y=(top+bottom)/2,hit=document.elementFromPoint(x,y);
     if(el.contains(hit))return {x,y};
    }
    return null;
   });
   check(!!point,'highlight exposes the actual tap target');await page.mouse.click(point.x,point.y);
  }
  async function walkthrough(label,screenshots){
   const historyLength=await page.evaluate(()=>history.length);
   for(let n=1;n<=14;n++){
    await step(n);
    check(await page.locator('.tour-panel').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),label+' step '+n+' guide fits');
    check(await page.evaluate(()=>{const r=document.querySelector('.tour-ring').getBoundingClientRect(),p=document.querySelector('.tour-panel').getBoundingClientRect();return r.width>20&&r.height>20&&!(r.left<p.right&&r.right>p.left&&r.top<p.bottom&&r.bottom>p.top);}),label+' step '+n+' guide does not cover target');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' step '+n+' no horizontal overflow');
    if(screenshots&&[1,2,3,5,7,9,11,12,14].includes(n))await page.screenshot({path:artifacts+'/'+label+'-'+n+'.png',animations:'disabled'});
    await tap();
   }
   await page.waitForFunction(()=>!OnboardingTour.active);
   check(await page.locator('.tour-root,.tour-space,.tour-target').count()===0,label+' tour cleans up');
   check(await page.evaluate(()=>history.length)===historyLength,label+' tour does not add preview history entries');
  }
  await route('#/');check(await page.locator('.ob-root,.tour-root').count()===0,'web does not auto-start intro');
  // Android detection uses the same first-launch gate as the native shell.
  const native=await browser.newContext({viewport:{width:390,height:844}});
  await native.addInitScript(()=>{window.PengoNative={getPlatform:()=> 'android',setDarkTheme:()=>{}};});
  const android=await native.newPage();await android.goto(base);await android.waitForSelector('.ob-root');
  check(await android.evaluate(()=>Platform.isAndroidApp),'Android first-launch detection');
  await android.locator('.ob-cta').click();await android.locator('.ob-cta').click();await android.waitForSelector('.tour-target');
  check(await android.evaluate(()=>!localStorage.getItem(ONBOARD_KEY)),'intro remains incomplete until tour exits');
  await android.evaluate(()=>KKBack());await android.waitForFunction(()=>!OnboardingTour.active);
  check(await android.evaluate(()=>localStorage.getItem(ONBOARD_KEY)==='1'),'Android Back exits tour and marks intro seen');
  await android.reload();await android.waitForFunction(()=>DB.loaded);
  check(await android.locator('.ob-root,.tour-root').count()===0,'native intro is shown only once');await native.close();
  // Complete the first-run tour, then proceed to study-plan setup.
  await page.goto(base+'?onboarding=1');await page.locator('.ob-cta').click();await page.locator('.ob-cta').click();
  await walkthrough('mobile-light',true);await page.waitForSelector('#planStart');
  check(await page.evaluate(()=>localStorage.getItem(ONBOARD_KEY)==='1'),'finish marks onboarding complete');
  // Replay with both formats saved, real history/mistakes, and an existing plan.
  await route('#/learn?section=quiz&start=1&kind=vocab&size=3');
  await page.locator('[data-answer]').first().click();
  await route('#/flashcards?daily=1');await page.locator('#practiceReveal').click();
  await page.evaluate(()=>{store.course=Course.defaultCourse('N5');save();});
  await route('#/settings');
  const before=await page.evaluate(()=>JSON.stringify(store));
  await page.locator('#sIntro').click();await page.locator('.ob-cta').click();await page.locator('.ob-cta').click();
  await step(1);
  await page.evaluate(()=>{studyTimeTick=Date.now()-20000;flushStudyTime();});
  check(await page.evaluate(()=>JSON.stringify(store))===before,'tour time is excluded from study activity');
  // A stray tap and Tab cannot activate unrelated study controls.
  await page.evaluate(()=>document.querySelector('#topSearchInput').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  check(await page.locator('#tourTitle').textContent()==='Start with a little discovery','unrelated click cannot advance tour');
  await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement.closest('.tour-panel')!==null),'Tab stays with tour controls');
  await walkthrough('replay-mobile',false);await page.waitForSelector('#sIntro');
  check(await page.evaluate(()=>JSON.stringify(store))===before,'replay preserves saved decks, quiz answers, mistakes, plan, scores and activity');
  // Repeat all steps in compact, landscape, tablet and desktop layouts/themes.
  for(const config of [{width:320,height:640,theme:'dark'},{width:844,height:390,theme:'light'},{width:768,height:1024,theme:'dark'},{width:1280,height:900,theme:'light'}]){
   await page.setViewportSize(config);await page.evaluate(theme=>{store.settings.theme=theme;save();applyTheme();},config.theme);
   await page.evaluate(()=>OnboardingTour.start({replay:true}));
   await walkthrough(config.width+'-'+config.theme,true);
  }
  // All challenges complete is an informational step, rather than a missing target.
  await page.evaluate(()=>{
   const day=studyDay(Course.todayStr());day.practiced={};day.recalled={};
   for(const [kind,rows] of [['kanji',DB.levels.N5],['vocab',DB.vocab.N5],['grammar',DB.grammar.N5]])rows.slice(0,5).forEach(r=>{const key=kind+':'+(r.k||r.id);day.practiced[key]=true;if(kind==='kanji')day.recalled[key]=true;});
   save();OnboardingTour.start({replay:true});
  });
  for(let n=1;n<=8;n++){await step(n);await tap();}await step(9);
  check(await page.locator('.tour-next').count()===1&&(await page.locator('#tourText').textContent()).includes('finished today’s challenges'),'completed challenges have a useful fallback');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!OnboardingTour.active);
  // Reloading a preview leaves it safely; it cannot create or replace a real session.
  await route('#/settings');const saved=await page.evaluate(()=>JSON.stringify(store.practice));
  await page.evaluate(()=>OnboardingTour.start({replay:true}));await step(1);await tap();await step(2);await page.reload();await page.waitForFunction(()=>DB.loaded);
  check(await page.evaluate(()=>JSON.stringify(store.practice))===saved,'reload cannot turn a tutorial preview into a saved deck');
  check(await page.evaluate(()=>location.hash)==='#/'&&await page.locator('.tour-root').count()===0,'reload drops stale preview route');
  // After exit, ordinary card interactions still save normally.
  await page.evaluate(()=>{store.practice.session=null;store.practice.pausedSession=null;save();go('#/flashcards?daily=1');});
  await page.waitForSelector('#practiceReveal');const realCard=await page.evaluate(()=>store.practice.session.questions[0]);
  await page.locator('#practiceReveal').click();await page.locator('#practiceRemembered').click();
  check(await page.evaluate(q=>store.practice.session.cursor===1&&courseIsLearned(q.type,q.id)&&store.study.days[Course.todayStr()].recalled[q.type+':'+q.id],realCard),'normal learning still records a real card after tutorial');
  const offline=await context.newPage();
  await offline.goto(require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../index.html')).href+'#/settings');
  await offline.waitForFunction(()=>DB.loaded);await offline.waitForSelector('#sIntro');
  await offline.locator('#sIntro').click();await offline.locator('.ob-cta').click();await offline.locator('.ob-cta').click();await offline.waitForSelector('.tour-target');
  check(await offline.evaluate(()=>DB.source)==='bundle','offline file mode loads bundled data');
  await offline.locator('.hero-start').click();await offline.waitForSelector('#practiceReveal');
  await offline.locator('.tour-skip').click();await offline.waitForSelector('#sIntro');
  check(await offline.locator('.tour-root').count()===0,'offline intro replay and skip work');await offline.close();
  check(errors.length===0,'no runtime errors: '+errors.join('; '));console.log('Interactive tutorial: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
