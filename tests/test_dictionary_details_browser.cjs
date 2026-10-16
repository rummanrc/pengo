/* Dictionary scope, structural/story separation, and real quiz score feedback. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-dictionary-details-qa';
let checks=0;function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const browser=await chromium.launch({channel:process.env.PENGO_CHROME_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  async function route(hash){await page.goto(base+hash);await page.waitForFunction(()=>DB.loaded);await page.evaluate(h=>go(h),hash);}
  await route('#/');
  check(await page.locator('#topSearchInput').getAttribute('placeholder')==='Search any word','topbar dictionary placeholder');
  check(await page.locator('[data-pengo-tip],[data-pengo-bubble]').count()===0,'tips fully removed');
  check(await page.locator('.hero-pengo').evaluate(el=>getComputedStyle(el).animationName)==='none','greeting mascot is static with normal motion');
  await page.locator('#topSearchInput').fill('学校');await page.locator('#topSearchInput').press('Enter');
  await page.waitForSelector('#sq');await page.waitForSelector('#sRes .vcard');
  check(await page.locator('#sq').inputValue()==='学校','topbar submits dictionary query');
  check(await page.locator('#sRes a[href^="#/k/"],#sRes a[href^="#/g/"]').count()===0,'only vocabulary results');
  await page.evaluate(()=>{
   DB.vocab.N1.unshift({id:'dictionary-headword',word:'辞書試験',reading:'ジショシケン',meaning:'dictionaryfixture primary',meanings:['alternatefixture'],jlpt:'N1'},
    {id:'dictionary-example',word:'例文試験',reading:'れいぶんしけん',meaning:'unrelated',jlpt:'N1',seq:'metadatafixture',mnemonic:'storyfixture',sentences:[{jp:'辞書試験',en:'dictionaryfixture alternatefixture'}]});
   DB.levels.N5[0].meaning+=' dictionaryfixture';DB.grammar.N5[0].meaning+=' dictionaryfixture';
  });
  for(const query of ['dictionaryfixture','alternatefixture','辞書試験','じしょしけん','ジショシケン']){
   await page.locator('#sq').fill(query);
   await page.waitForFunction(()=>document.querySelector('#sRes .result-count').textContent==='1 word');
   check(await page.locator('#sRes .vcard a').getAttribute('href')==='#/v/dictionary-headword',query+' matches only dictionary fields across levels');
   check(await page.locator('#sq').evaluate(el=>document.activeElement===el),'dictionary typing retains focus');
  }
  for(const query of ['metadatafixture','storyfixture','no-such-word-fixture']){
   await page.locator('#sq').fill(query);await page.waitForFunction(()=>document.querySelector('#sRes .result-count').textContent==='0 words');
   check(await page.locator('#sRes .empty').isVisible(),query+' does not match other fields');
  }
  await page.locator('#sq').fill('');await page.waitForSelector('#sRes .empty');await page.waitForFunction(()=>!document.querySelector('#sRes .result-count'));
  check(await page.locator('#sRes .vcard').count()===0,'empty query invites dictionary lookup');
  await route('#/k/語');
  assert.deepEqual(await page.locator('.detail-title .stat-row .badge').allTextContents(),['JLPT N5']);checks++;
  assert.deepEqual(await page.locator('.structural-parts > .comp-list > .comp > .cchar,.structural-parts > .comp-list > .component-branch > .comp > .cchar').allTextContents(),['言','吾']);checks++;
  assert.deepEqual(await page.locator('.mnemonic-parts [lang=ja]').allTextContents(),['言','口','五']);checks++;
  check(await page.locator('.mnemonic-card .comp,.mnemonic-card .badge,.comp-col .badge').count()===0,'story parts are compact; components have no badges');
  check(!/LARGER SHAPES|Keep useful|Kangxi #|True Kangxi|Learning component|PARTS IN YOUR MEMORY STORY|Based on:/.test(await page.locator('#view').textContent()),'retired detail labels removed');
  check((await page.locator('.mnemonic-card').textContent()).includes('not the kanji’s origin'),'plain-language memory warning remains');
  const inside=page.locator('.component-inside').filter({has:page.locator('summary').filter({hasText:'Inside 吾'})});
  await inside.locator('summary').first().click();
  assert.deepEqual(await inside.locator(':scope > .component-children > .comp > .cchar,:scope > .component-children > .component-branch > .comp > .cchar').allTextContents(),['五','口']);checks++;
  await inside.locator('summary').first().click();check(await inside.evaluate(el=>!el.open),'deeper breakdown can collapse');
  await page.locator('summary').filter({hasText:'Compare finer parts'}).click();
  check(await page.locator('.learning-components > details[open] .comp').count()>0,'finer structural comparison still available');
  const fallback=await page.evaluate(()=>componentsHTML({k:'fixture',components:[{c:'木',m:'tree'}]}));
  check(fallback.includes('tree')&&!fallback.includes('mnemonic'),'flat structural fallback remains');
  const word=await page.evaluate(()=>DB.vocab.N5[0].id);await route('#/v/'+word);
  check(await page.locator('.detail-title .stat-row .badge').count()===1&&!(await page.locator('.detail-title').textContent()).includes('JMdict #'),'vocabulary shows JLPT without corpus ID');
  for(const score of [0,2,3,4,5]){
   await route('#/learn?section=quiz&start=1&kind=mixed&lv=N5&size=5');await page.waitForSelector('[data-answer]');
   for(let i=0;i<5;i++){
    await page.locator('[data-answer]').evaluateAll((buttons,ok)=>{const q=store.practice.session.questions[store.practice.session.cursor];buttons.find(b=>ok?b.dataset.answer===q.id:b.dataset.answer!==q.id).click();},i<score);
    await page.locator('#practiceNext').click();
   }
   const title=await page.locator('.quiz-result h2').textContent();
   const expected=score===5?'Every answer right. Amazing work!':score===4?'Look at that progress!':score===3?'You’re getting there!':'Every try helps you learn.';
   check(title===expected,score+'/5 has appropriate feedback');
   check(await page.locator('.result-stats').textContent().then(t=>t.includes(score+' / 5')),'score remains accurate');
   await page.waitForFunction(()=>document.querySelector('.quiz-result-img').complete);
   check(await page.locator('.quiz-result-img').evaluate(img=>img.complete&&img.naturalWidth>0),'result mascot loads');
   if(score<3){
    check(await page.locator('.quiz-result-img').getAttribute('src')==='assets/pengo-discover.png','low score has learning mascot');
    check(await page.locator('.celebration-sparkles').count()===0,'low score has calm encouragement');
   }
   if([0,3,5].includes(score))await page.screenshot({path:artifacts+'/result-'+score+'.png',fullPage:true,animations:'disabled'});
  }
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:844});await page.evaluate(t=>{store.settings.theme=t;save();applyTheme();},theme);
   for(const hash of ['#/k/語','#/v/'+word,'#/search?q=school','#/']){
    await route(hash);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' '+hash+' fits');
   }
   await route('#/k/語');await page.screenshot({path:artifacts+'/kanji-'+width+'-'+theme+'.png',fullPage:true});
  }
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Dictionary/detail refresh: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
