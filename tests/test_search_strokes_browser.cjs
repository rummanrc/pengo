/* English word boundaries, centered detail heroes, credits, and offline SVG recovery. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=process.env.PENGO_TEST_URL||'http://127.0.0.1:8000/';
const artifacts=process.env.PENGO_TEST_ARTIFACTS||'/tmp/pengo-search-strokes-qa';
let checks=0;function check(ok,label){assert.ok(ok,label);checks++;}
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 // Every fallback must preserve the source diagram, including its copyright notice.
 const bundle={window:{}};
 for(const file of fs.readdirSync('data/strokes'))vm.runInNewContext(fs.readFileSync('data/strokes/'+file,'utf8'),bundle);
 const source=fs.readdirSync('resources/stroke-order/kanjivg').filter(f=>f.endsWith('.svg'));
 check(Object.keys(bundle.window.KK_STROKES).length===source.length,'fallback covers every bundled SVG');
 check(source.every(file=>bundle.window.KK_STROKES[file.slice(0,-4)]===fs.readFileSync('resources/stroke-order/kanjivg/'+file,'utf8')),'all SVG bytes and notices retained');
 const browser=await chromium.launch({channel:process.env.PENGO_CHROME_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  let navigation=0;
  async function route(hash){await page.goto(base+'?qa='+(++navigation)+hash);await page.waitForFunction(()=>DB.loaded);}
  await route('#/search?q=car');await page.waitForSelector('#sRes .vcard');
  const words=await page.locator('#sRes .vword').allTextContents();
  check(words.includes('車'),'car finds the actual headword');
  check(!words.includes('強力'),'car excludes the carrier-guide alternate gloss');
  check(words.length<88,'car excludes irrelevant substring matches');
  console.log('car results: '+words.length+'; '+words.join(', '));
  await page.evaluate(()=>{
   const fixture=meaning=>({word:'試験',reading:'しけん',meaning,meanings:[]});
   const matches=meaning=>matchVQuery(fixture(meaning),'car');
   if(!['car','rental car','car-park','a car, automobile'].every(matches))throw Error('whole-word car matches missing');
   if(['scarce','carry','carrier-guide','carrot','scary'].some(matches))throw Error('substring leak');
   if(!matchVQuery({...fixture('vehicle'),meanings:['motor car']},'car'))throw Error('alternate gloss missing');
   if(!matchVQuery(fixture('a rental car'),'  RENTAL   CAR  '))throw Error('phrase whitespace/case');
   if(!matchVQuery(fixture('C++'),'c++')||matchVQuery(fixture('C--'),'c++'))throw Error('literal query punctuation');
   if(!matchVQuery({word:'カメラ',reading:'カメラ',meaning:'camera'},'かめら'))throw Error('kana folding');
  });checks+=6;
  await route('#/vocab/N3?q=car');await page.waitForSelector('#vq');
  const scopedWords=await page.locator('#vocabGrid .vword').allTextContents();
  check(scopedWords.length>0&&!scopedWords.includes('強力'),'Learn browser uses whole-word matching within N3');
  await route('#/k/語');await page.waitForSelector('#strokeBox svg');
  check(await page.locator('#strokeBox .kvg-stroke').count()===14,'HTTP stroke diagram retains all strokes');
  check(await page.evaluate(()=>!window.KK_STROKES),'normal HTTP diagram does not load the fallback');
  check(await page.locator('.component-attribution').count()===0,'component credit removed from the learning view');
  await route('#/settings');await page.locator('#credits summary').click();
  check((await page.locator('#credits').textContent()).includes('© Ulrich Apel'),'author credited in Settings');
  check(await page.locator('#credits a[href="https://kanjivg.tagaini.net/"]').isVisible(),'KanjiVG source link in Settings');
  check(await page.locator('#credits a[href="https://creativecommons.org/licenses/by-sa/3.0/"]').isVisible(),'license link in Settings');
  check(await page.locator('#credits a[href="resources/CREDITS.md"]').isVisible(),'full credits linked in Settings');
  await page.locator('#credits').screenshot({path:artifacts+'/settings-credits.png'});
  const ids=await page.evaluate(()=>['車','学校','勉強する'].map(word=>Object.values(DB.vById).find(v=>v.word===word)?.id).filter(Boolean));
  check(ids.length>=2,'real single/multi-character alignment fixtures');
  for(const width of [700,768,1024,1440])for(const theme of ['light','dark'])for(const id of ids){
   await page.setViewportSize({width,height:900});await route('#/v/'+id);
   await page.evaluate(t=>{store.settings.theme=t;applyTheme();},theme);
   check(await page.locator('.vocab-hero').evaluate(el=>{
    const box=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);
    const text=range.getBoundingClientRect();
    return Math.abs((box.left+box.right-text.left-text.right)/2)<1&&Math.abs((box.top+box.bottom-text.top-text.bottom)/2)<3;
   }),width+' '+theme+' '+id+' text is centered on both axes');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' vocab fits');
  }
  await page.screenshot({path:artifacts+'/vocab-desktop-dark.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  check(await page.locator('.vocab-hero').isHidden(),'compact vocab layout stays hidden on phones');
  // Reproduce the reported fetchErr:TypeError;xhrErr failure.
  await page.route('**/resources/stroke-order/kanjivg/*.svg',r=>r.abort());
  await page.emulateMedia({reducedMotion:'reduce'});
  await route('#/k/語');await page.waitForSelector('#strokeBox svg');
  check(await page.evaluate(()=>KKDiag.stroke.includes('fetchErr:TypeError;xhrErr;')&&KKDiag.stroke.includes('script;')),'fetch and XHR failures recover through the script fallback');
  check(await page.locator('#strokeBox .kvg-stroke').count()===14,'recovered diagram has every stroke');
  check(await page.locator('#strokePlay').isEnabled(),'recovered diagram enables replay');
  await page.locator('#strokePlay').click();
  check(await page.locator('#strokeBox .kvg-stroke.done').count()===14,'fallback replay respects reduced motion');
  await page.locator('#strokeNums').uncheck();
  check(await page.locator('#strokeBox text').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display==='none')),'fallback number toggle works');
  await page.screenshot({path:artifacts+'/kanji-fallback-mobile.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await route('#/k/語');await page.waitForSelector('#strokeBox svg');
  await page.locator('#strokePlay').click();await page.waitForTimeout(180);
  check(await page.locator('#strokeBox .kvg-stroke').first().evaluate(p=>{
   const offset=parseFloat(getComputedStyle(p).strokeDashoffset);
   return offset>0&&offset<p.getTotalLength();
  }),'fallback animates an intermediate stroke with ordinary motion');
  // Failed fallback loads must allow another attempt on reopening the page.
  await page.route('**/data/strokes/*.js',r=>r.abort());
  await route('#/k/語');await page.waitForSelector('#strokeBox .explain');
  await page.waitForFunction(()=>document.querySelector('#strokeBox').textContent.includes('Try reopening'));
  check(await page.locator('#strokePlay').isDisabled()&&await page.locator('#strokeNums').isDisabled(),'unavailable diagram disables inactive controls');
  check(!/fetchErr|xhrErr|len0/.test(await page.locator('#strokeBox').textContent()),'technical diagnostics stay out of the learning UI');
  await page.unroute('**/data/strokes/*.js');
  await page.evaluate(()=>render());await page.waitForSelector('#strokeBox svg');
  check(await page.locator('#strokePlay').isEnabled(),'reopening retries after a fallback load failure');
  await page.unroute('**/resources/stroke-order/kanjivg/*.svg');
  await page.route('**/resources/stroke-order/kanjivg/*.svg',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><p>Missing asset</p>'}));
  await route('#/k/語');await page.waitForSelector('#strokeBox svg');
  check(await page.evaluate(()=>KKDiag.stroke.includes('script;')),'non-SVG response also recovers');
  for(const file of ['index.html','www/index.html']){
   const offline=await browser.newPage({reducedMotion:'reduce'});offline.on('pageerror',e=>errors.push(e.message));
   await offline.goto('file://'+path.resolve(file)+'#/k/語');await offline.waitForSelector('#strokeBox svg');
   check(await offline.evaluate(()=>DB.source==='bundle'&&KKDiag.stroke.startsWith('script;')),'file:// '+file+' loads data and strokes without fetch/XHR');
   check(await offline.locator('#strokeBox .kvg-stroke').count()===14,'file:// '+file+' has complete art');
   await offline.locator('#strokePlay').click();check(await offline.locator('#strokeBox .done').count()===14,'file:// '+file+' replay works');
   await offline.evaluate(()=>go('#/k/漢'));await offline.waitForSelector('#strokeBox svg');
   check(await offline.locator('#strokeBox .kvg-stroke').count()===13,'file:// loads another fallback chunk');
   await offline.close();
  }
  check(errors.length===0,'no runtime errors: '+errors.join('; '));
  console.log('Search/strokes: '+checks+' checks passed; screenshots '+artifacts);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
