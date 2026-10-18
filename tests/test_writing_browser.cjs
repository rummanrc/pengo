/* Real SVG geometry, mouse/pen/touch input, grading, cancellation, and offline fallback. */
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PENGO_TEST_URL || 'http://127.0.0.1:8000/';
const artifacts = process.env.PENGO_TEST_ARTIFACTS || '/tmp/pengo-writing-qa';
const isWebKit = process.env.PENGO_TEST_ENGINE === 'webkit';
let checks = 0;
function check(ok, label) { assert.ok(ok, label); checks++; }
(async () => {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = isWebKit ? await webkit.launch({headless:true}) :
    await chromium.launch({channel:process.env.PENGO_CHROME_CHANNEL || 'chrome', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}, hasTouch:true});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    async function open(character, url=base) {
      await page.goto(url + '#/k/' + encodeURIComponent(character));
      await page.waitForSelector('#strokeBox .kvg-stroke');
      await page.locator('#writingStart').click();
      await page.waitForSelector('.writing-board');
      await page.locator('.writing-board').scrollIntoViewIfNeeded();
    }
    async function points(index) {
      return page.evaluate(index => {
        const p = document.querySelectorAll('#strokeBox .kvg-stroke')[index];
        const svg = p.ownerSVGElement, board = document.querySelector('.writing-board');
        const transform = svg.getScreenCTM().inverse().multiply(p.getScreenCTM());
        const vb = svg.viewBox.baseVal, screen = board.getScreenCTM(), length = p.getTotalLength();
        return Array.from({length:48}, (_, i) => {
          const pt = p.getPointAtLength(length*i/47).matrixTransform(transform);
          const out = new DOMPoint((pt.x-vb.x)*109/vb.width,(pt.y-vb.y)*109/vb.height).matrixTransform(screen);
          return {x:out.x,y:out.y};
        });
      }, index);
    }
    async function draw(coords, type='mouse') {
      if (type === 'touch' && !isWebKit) {
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...coords[0],id:1}]});
        for (const p of coords.slice(1)) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await client.detach();
      } else if (type === 'pen' && !isWebKit) {
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...coords[0],button:'left',buttons:1,clickCount:1,pointerType:'pen'});
        for (const p of coords.slice(1)) await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1,pointerType:'pen'});
        await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...coords[coords.length-1],button:'left',buttons:0,clickCount:1,pointerType:'pen'});
        await client.detach();
      } else {
        await page.mouse.move(coords[0].x,coords[0].y); await page.mouse.down();
        for (const p of coords.slice(1)) await page.mouse.move(p.x,p.y);
        await page.mouse.up();
      }
    }
    await open('三');
    const saved = await page.evaluate(()=>JSON.stringify(store));
    check(await page.locator('#writingCount').textContent()==='Stroke 1 of 3','initial stroke count');
    check(await page.locator('.writing-board').evaluate(el=>getComputedStyle(el).touchAction)==='none','only drawing board suppresses touch scrolling');
    await draw((await points(0)).reverse());
    check((await page.locator('#writingFeedback').textContent()).includes('other direction'),'reverse direction rejected');
    check(await page.locator('.writing-accepted').count()===0,'wrong stroke never advances');
    await draw(await points(1));
    check((await page.locator('#writingFeedback').textContent()).includes('matches stroke 2'),'wrong order identifies the stroke');
    const first = await points(0);
    await draw(first.slice(0,10));
    check((await page.locator('#writingFeedback').textContent()).includes('whole blue stroke'),'unfinished line rejected');
    await draw([first[0],first[0]]);
    check(await page.locator('.writing-accepted').count()===0,'tap rejected');
    const scroll = await page.evaluate(()=>scrollY);
    await draw(await points(0),'touch');
    check(await page.locator('.writing-accepted').count()===1,isWebKit?'WebKit mouse input accepted':'real touch input accepted');
    check(Math.abs((await page.evaluate(()=>scrollY))-scroll)<2,'tracing does not scroll the page');
    await draw(await points(1));
    await page.locator('#writingUndo').click();
    check(await page.locator('.writing-accepted').count()===1,'undo removes last accepted stroke');
    await page.locator('.writing-board').scrollIntoViewIfNeeded();
    await draw(await points(1)); await draw(await points(2));
    check(await page.locator('#writingCard').getAttribute('data-writing-state')==='complete','all strokes complete the character');
    check((await page.locator('#writingFeedback').textContent()).includes('Correct! You wrote 三'),'final success names the character');
    check(await page.locator('.writing-next').count()===0,'completion removes next-stroke prompt');
    check(await page.evaluate(()=>JSON.stringify(store))===saved,'tracing does not mutate learned/SRS/quiz state');
    await page.screenshot({path:artifacts+'/phone-complete.png',fullPage:true});
    await page.locator('#writingReset').click();
    check(await page.locator('.writing-accepted').count()===0 && await page.locator('#writingUndo').isDisabled(),'restart clears all ink');
    await page.locator('.writing-board').scrollIntoViewIfNeeded();
    await draw(await points(0),'pen');
    check(await page.locator('.writing-accepted').count()===1,isWebKit?'WebKit repeat input accepted':'pen input accepted');
    await page.locator('#writingStart').click();
    check(await page.locator('#writingPanel').isHidden(),'practice closes');
    await page.locator('#writingStart').click();
    check(await page.locator('.writing-accepted').count()===1,'close and reopen retains current ink');
    await page.locator('#writingReset').click();
    await page.locator('.writing-board').scrollIntoViewIfNeeded();
    // A system interruption discards the active stroke and allows another pointer.
    // Use a real pointer for capture; extra fingers must not replace it.
    const p = await points(0); await page.mouse.move(p[0].x,p[0].y); await page.mouse.down();
    await page.locator('.writing-board').dispatchEvent('pointerdown',{pointerId:999,pointerType:'touch',clientX:10,clientY:10});
    await page.locator('.writing-board').dispatchEvent('pointercancel',{pointerId:1}); await page.mouse.up();
    check(await page.locator('.writing-accepted').count()===0,'cancelled/multi-pointer input does not advance');
    await page.locator('#writingReset').click();
    await page.setViewportSize({width:844,height:390});
    await page.locator('.writing-board').scrollIntoViewIfNeeded();
    await draw(await points(0));
    check(await page.locator('.writing-accepted').count()===1,'coordinates survive orientation change');
    await open('永');
    for(let i=0;i<5;i++) { await page.locator('.writing-board').scrollIntoViewIfNeeded(); await draw(await points(i)); }
    check(await page.locator('#writingCard').getAttribute('data-writing-state')==='complete','curves and joined hook strokes accepted');
    for (const width of [320,390,768,1440]) for (const theme of ['light','dark']) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme+' has no horizontal overflow');
      await page.locator('#writingReset').click();
      await page.locator('.writing-board').scrollIntoViewIfNeeded();
      await page.locator('#writingCard').screenshot({path:artifacts+'/writing-'+width+'-'+theme+'.png'});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/resources/stroke-order/kanjivg/*.svg',r=>r.abort());
    await open('一');
    check(await page.evaluate(()=>KKDiag.stroke.includes('script;')),'blocked SVG fetch uses bundled fallback');
    await draw(await points(0));
    check(await page.locator('#writingCard').getAttribute('data-writing-state')==='complete','fallback tracing works with reduced motion');
    await page.route('**/data/strokes/*.js',r=>r.abort());
    await page.goto(base+'#/k/語');
    await page.waitForFunction(()=>document.querySelector('#writingAvailability').textContent.includes('Could not load'));
    check(await page.locator('#writingStart').isDisabled(),'missing art disables practice with an explanation');
    await page.unroute('**/data/strokes/*.js'); await page.unroute('**/resources/stroke-order/kanjivg/*.svg');
    await page.evaluate(()=>{ store.course={target:'N5'}; go('#/k/永'); });
    await page.waitForSelector('#strokeBox .kvg-stroke');
    await page.locator('#writingStart').click();
    check(await page.locator('.browse-only').isVisible() && await page.locator('.writing-board').isVisible(),'other levels allow ephemeral tracing without plan changes');
    await page.evaluate(()=>go('#/k/三'));
    await page.waitForSelector('#strokeBox .kvg-stroke');
    await page.locator('#writingStart').click();
    check(await page.locator('.writing-accepted').count()===0,'navigation starts a fresh character');
    check(errors.length===0,'no HTTP page errors: '+errors.join('; '));
    errors.length = 0;
    await open('一', 'file://'+path.resolve('www/index.html'));
    await draw(await points(0));
    check(await page.locator('#writingCard').getAttribute('data-writing-state')==='complete','staged file:// package works offline');
    // Desktop WebKit reports blocked file:// JSON fetches as page errors even
    // though loadData recovers through bundle.js. The iOS shell uses pengo://.
    check(errors.every(error=>isWebKit && error.includes(path.resolve('www/data')+'/') &&
      error.endsWith('.json due to access control checks.')),'no unexpected file page errors: '+errors.join('; '));
    console.log('Writing browser ('+(isWebKit?'WebKit':'Chrome')+'): '+checks+' checks passed; screenshots '+artifacts);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
