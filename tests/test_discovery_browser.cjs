/* Isolated end-to-end checks for recall decks, hierarchy and text-only packaging. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PENGO_TEST_URL || 'http://127.0.0.1:8000/';
const artifacts = process.env.PENGO_TEST_ARTIFACTS || '/tmp/pengo-discovery-qa';
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(STORE_KEY)));
  await route('#/');
  check(await page.locator('.challenge-list a').count()===3,'daily challenges open targeted learning');
  check(!(await page.locator('#view').textContent()).includes('undefined'),'dashboard has valid card totals');
  await route('#/flashcards?start=1&mode=explore&size=3&kind=kanji');await page.waitForSelector('#practiceReveal');
  const initial=await state(),first=initial.practice.session.questions[0];
  check(initial.practice.session.questions.length===3,'daily deck is three cards');
  check(initial.practice.session.questions.every(q=>q.type==='kanji'),'kanji challenge keeps kanji focus');
  check(await page.locator('#recallDetails').isHidden(),'details hidden before guessing');
  check(await page.locator('#recallBack').getAttribute('aria-hidden')==='true','answer face hidden from assistive technology');
  check(await page.locator('#practiceNext').isHidden(),'cannot advance before rating');
  await page.locator('#practiceReveal').click();
  check(await page.locator('#recallFlipper').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s','reduced motion skips flip animation');
  check(await page.locator('#recallDetails').isVisible(),'flip reveals memory story and components');
  check((await state()).practice.session.answers.length===0,'flip alone does not grade');
  check(await page.locator('#recallBack').getAttribute('aria-hidden')==='false','answer face becomes accessible');
  check(await page.locator('#practiceReveal').evaluate(el=>el.inert),'hidden front cannot receive focus');
  await page.locator('#recallHide').click();
  check(await page.locator('#practiceRatings').isHidden(),'turning back hides recall ratings');
  await page.locator('#practiceReveal').click();await page.locator('#practiceAgain').click();
  let s=await state(),today=await page.evaluate(()=>Course.todayStr());
  check((s.study.days[today].attempts||0)===0,'learning does not add a quiz attempt');
  check(s.study.days[today].recalled['kanji:'+first.id],'rating records distinct card challenge progress');
  check(!s.practice.mistakes['kanji:'+first.id],'learning confidence does not create quiz mistakes');
  await page.evaluate(()=>document.querySelector('#practiceRemembered').click());
  check(((await state()).study.days[today].attempts||0)===0,'double click cannot double grade');
  await page.reload();await page.waitForSelector('#practiceNext');
  check(await page.locator('#practiceNext').isVisible(),'answered card restores feedback on reload');
  check(((await state()).study.days[today].attempts||0)===0,'resume cannot double grade');
  await page.locator('#practiceNext').click();
  await page.locator('#practiceReveal').click();await page.locator('#practiceAgain').click();
  await page.locator('#recallStage').evaluate(el=>{
   el.dispatchEvent(new PointerEvent('pointerdown',{clientX:250,clientY:100,button:0,isPrimary:true,bubbles:true}));
   el.dispatchEvent(new PointerEvent('pointerup',{clientX:100,clientY:110,button:0,isPrimary:true,bubbles:true}));
  });
  check((await state()).practice.session.cursor===2,'rated card advances with a horizontal swipe');
  await page.locator('#practiceReveal').click();await page.locator('#practiceAgain').click();
  await page.keyboard.press('ArrowRight');await page.getByRole('heading',{name:'Learning complete',exact:true}).waitFor();
  check((await state()).practice.history.length===1,'completed deck records one summary');
  await route('#/');
  check(await page.locator('[data-challenge=flip]').evaluate(el=>el.classList.contains('challenge-done')),'three unique ratings finish daily kanji challenge');
  check(await page.evaluate(()=>!recallDetailsHTML({type:'kanji',head:DB.byChar['社'].item}).includes('#2028980')),'card examples exclude corpus index markup');
  await route('#/k/語');
  check(await page.evaluate(()=>learningComponents(DB.byChar['語'].item).map(c=>c.c).join(''))==='言吾','larger structural chunks preserved');
  check(await page.evaluate(()=>storyComponents(DB.byChar['語'].item).map(c=>c.c).join(''))==='吾言','story references match existing mnemonic');
  await page.locator('summary').filter({hasText:'Inside 吾'}).click();
  check(await page.locator('.component-inside[open]').textContent().then(s=>s.includes('五')&&s.includes('口')),'second-level breakdown expands independently');
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844});
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>{store.settings.theme=theme;applyTheme();store.practice.session=null;startPractice(document.querySelector('#view'),Practice.config({mode:'explore',kind:'kanji',lv:'N5',size:3,format:'recall'}));},theme);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px '+theme+' front has no overflow');
    await page.screenshot({path:path.join(artifacts,`front-${width}-${theme}.png`)});
    await page.locator('#practiceReveal').click();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px '+theme+' revealed details have no overflow');
    await page.screenshot({path:path.join(artifacts,`back-${width}-${theme}.png`),fullPage:true});
   }
  }
  await route('#/settings');
  check(await page.locator('[data-vocab-audio],.vocab-audio,#audioSettings,[name=format] option[value=listening]').count()===0,'retired audio controls absent');
  check(await page.evaluate(()=>typeof Pronunciation==='undefined'&&typeof window.PengoAudioPack==='undefined'),'no speech runtime loaded');
  await page.evaluate(()=>{store.practice.session={version:1,id:'old-listening',config:{mode:'explore',kind:'vocab',lv:'N5',size:3,format:'listening'},cursor:0,answers:[],questions:[]};save();});
  await route('#/practice');check(await page.locator('#practiceResume').count()===0,'old listening session does not block new practice');
  const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.goto('file://'+path.resolve('www/index.html')+'#/k/語');await offline.waitForFunction(()=>DB.loaded);
  check(await offline.evaluate(()=>DB.source==='bundle'),'file URL uses fallback data bundle');
  check(await offline.locator('.component-inside').count()>0,'hierarchy works offline through script loading');
  check(!fs.existsSync('www/assets/audio')&&!fs.existsSync('www/pronunciation.js'),'staging contains no old audio');
  check(errors.length===0,'no runtime errors: '+errors.join(';'));
  console.log(`Discovery browser: ${checks} checks passed; screenshots ${artifacts}`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
