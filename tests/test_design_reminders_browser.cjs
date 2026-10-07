/* Isolated browser integration for the adventure UI, motion and reminder lifecycle. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.PENGO_TEST_URL || 'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS;
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;}
(async()=>{
 const browser=await chromium.launch(process.env.PENGO_CHROME_CHANNEL ? {channel:process.env.PENGO_CHROME_CHANNEL,headless:true} : {headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(hash=>go(hash),hash);}
  await route('#/');await page.waitForSelector('.adventure-home');
  check(await page.locator('.hero-pengo').evaluate(img=>img.complete&&img.naturalWidth>0),'generated Pengo illustration loads');
  check((await page.locator('.adventure-level strong').allTextContents()).join(',')==='N5,N4,N3,N2,N1','beginner-friendly level order');
  check(await page.locator('.hero-pengo').evaluate(el=>getComputedStyle(el).animationName)==='none','mascot respects reduced motion');
  await page.locator('[data-pengo-tip]').click();const tip=await page.locator('[data-pengo-bubble]').textContent();await page.locator('[data-pengo-tip]').click();
  check(tip!==await page.locator('[data-pengo-bubble]').textContent(),'mascot tips are interactive and rotate');
  check((await page.locator('[data-pengo-bubble]').textContent()).includes('sentence'),'tip handler binds once per route');
  await page.evaluate(()=>{store.course=Course.defaultCourse('N4');save();render();});
  check(await page.locator('.trail-step').count()===3,'learning trail offers real actionable steps');
  await page.locator('.trail-step').last().locator('a').click();await page.waitForFunction(()=>location.hash==='#/course/day');
  check((await page.locator('#view').textContent()).includes('Day 1'),'trail opens actual course batch');
  await route('#/practice');
  check(await page.locator('.practice-custom').evaluate(el=>!el.open),'detailed settings are optional');
  check(await page.locator('[data-quick-practice]').count()===4,'four quick-start practice choices');
  await page.locator('[data-quick-practice=smart]').click();
  check(await page.evaluate(()=>store.practice.session.questions.length)===3,'quick start opens three-question session');
  for(let i=0;i<3;i++){
    const ok=i!==1;
    await page.locator('[data-answer]').evaluateAll((buttons,ok)=>{const q=store.practice.session.questions[store.practice.session.cursor];buttons.find(b=>ok?b.dataset.answer===q.id:b.dataset.answer!==q.id).click();},ok);
    check((await page.locator('#practiceCoachImage').getAttribute('src')).includes(ok?'happy':'study'),'mascot reacts to '+(ok?'success':'learning'));
    await page.locator('#practiceNext').click();
  }
  check(await page.locator('.result-stats').count()===1,'result has clear visual learning stats');
  check(await page.locator('.celebration-sparkles').evaluate(el=>getComputedStyle(el).display)==='none','celebration respects reduced motion');
  await page.emulateMedia({reducedMotion:'no-preference'});
  check(await page.locator('.quiz-result-img').evaluate(el=>getComputedStyle(el).animationIterationCount)==='2','celebration animation is finite');
  await route('#/settings?section=reminders');
  check(await page.locator('#reminderSettings').evaluate(el=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<160),'reminder CTA scrolls to its settings');
  check(await page.evaluate(()=>Reminders.read().enabled)===false,'notifications off by default');
  check((await page.locator('#reminderSettings').textContent()).includes('while Pengo is open'),'browser lifetime limitation is visible');
  check((await page.locator('#reminderSettings').textContent()).includes('cannot check your Pengo goal'),'calendar goal limitation is visible');
  await page.locator('#reminderTime').fill('18:30');
  const download=page.waitForEvent('download');await page.locator('#reminderCalendar').click();const file=await download;
  check(file.suggestedFilename()==='pengo-daily-reminder.ics','calendar reminder downloads through a user action');
  check((await page.locator('#reminderMessage').textContent()).includes('Import it into your calendar'),'calendar import instructions shown');
  await page.evaluate(()=>{window.permissionRequests=0;Notification.requestPermission=async()=>{window.permissionRequests++;return 'denied';};});
  check(await page.evaluate(()=>window.permissionRequests)===0,'no unsolicited browser permission request');
  await page.locator('#reminderEnable').click();await page.waitForFunction(()=>!document.querySelector('#reminderEnable').disabled);
  check(await page.evaluate(()=>window.permissionRequests)===1,'permission requested only after opt-in');
  check(await page.evaluate(()=>Reminders.read().enabled)===false,'denial does not silently enable reminder');
  check((await page.locator('#reminderMessage').textContent()).includes('blocked'),'permission denial is explained');
  await context.grantPermissions(['notifications']);
  await page.locator('#reminderEnable').click();await page.waitForFunction(()=>Reminders.read().enabled);
  check(await page.evaluate(()=>Reminders.read().time)==='18:30','chosen reminder time saved');
  check(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())),'notification worker is actually registered');
  check(await page.evaluate(async()=>{store.settings.dailyGoal=3;save();const now=new Date();now.setHours(18,35,0,0);return practiceStats().goalMet && !(await Reminders.tick(now));}),'completed daily goal suppresses browser notification delivery');
  await page.evaluate(()=>{store.settings.dailyGoal=20;save();});
  const delivered=await page.evaluate(async()=>{
    const date=new Date();date.setHours(18,35,0,0);
    const r=Reminders.read();r.lastDate='';Reminders.write(r);
    return Reminders.tick(date);
  });
  check(delivered===true,'browser uses real notification delivery API');
  check(await page.evaluate(async()=>(await (await navigator.serviceWorker.ready).getNotifications()).length)>0,'notification can be retrieved from browser registration');
  check(await page.evaluate(async()=>{const now=new Date();now.setHours(18,40);return !(await Reminders.tick(now));}),'second daily notification suppressed');
  const last=await page.evaluate(()=>Reminders.read().lastDate);
  await page.locator('#reminderTime').fill('18:40');await page.locator('#reminderEnable').click();await page.waitForFunction(()=>!document.querySelector('#reminderEnable').disabled);
  check(await page.evaluate(()=>Reminders.read().lastDate)===last,'changing time cannot reset duplicate protection');
  await page.locator('#reminderDisable').click();check(await page.evaluate(()=>Reminders.read().enabled)===false,'turn off cancels browser reminder policy');
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{Reminders.write({enabled:true,time:'17:15'});importBackupText(JSON.stringify({learned:{},settings:{theme:'light'}}));});
  check(await page.evaluate(()=>Reminders.read().enabled&&Reminders.read().time==='17:15'),'backup import does not change device reminder opt-in');
  await route('#/settings');await page.locator('#sWipe').click();await page.locator('#sWipeConfirm').click();
  check(await page.evaluate(()=>!Reminders.read().enabled&&Reminders.read().time==='19:00'),'erase resets device reminders');
  await page.evaluate(()=>{store.course=Course.defaultCourse('N4');save();});

  await page.evaluate(async()=>{for(const n of await (await navigator.serviceWorker.ready).getNotifications())n.close();});
  const overflow=[];
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    for(const hash of ['#/','#/learn?lv=N4','#/practice','#/progress','#/settings']){
      await route(hash);
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))overflow.push({width,hash});
    }
  }
  check(overflow.length===0,'all main routes fit mobile, tablet and desktop: '+JSON.stringify(overflow));
  if(artifacts){
    await page.setViewportSize({width:1440,height:1000});await route('#/');await page.screenshot({path:path.join(artifacts,'pengo-adventure-desktop.png'),fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:390,height:844});await route('#/practice');await page.screenshot({path:path.join(artifacts,'pengo-review-mobile.png'),fullPage:true,animations:'disabled'});
    await page.evaluate(()=>{store.settings.theme='dark';save();applyTheme();});await route('#/');await page.screenshot({path:path.join(artifacts,'pengo-home-dark-mobile.png'),fullPage:true,animations:'disabled'});
  }
  check(errors.length===0,'no browser errors: '+errors.join(', '));
  await context.close();
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>Object.defineProperty(window,'Notification',{value:undefined,configurable:true}));
  const unsupportedPage=await unsupported.newPage();await unsupportedPage.goto(base+'#/settings?section=reminders');await unsupportedPage.waitForSelector('#reminderSettings');
  await unsupportedPage.locator('#reminderEnable').click();await unsupportedPage.waitForFunction(()=>!document.querySelector('#reminderEnable').disabled);
  check((await unsupportedPage.locator('#reminderMessage').textContent()).includes('unavailable'),'unsupported browser offers calendar fallback');
  check(await unsupportedPage.locator('#reminderCalendar').isEnabled(),'calendar remains available when browser notifications unsupported');await unsupported.close();
  console.log('Design/reminder browser:',checks,'checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
