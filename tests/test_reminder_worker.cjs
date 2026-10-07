const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../reminder-worker.js'),'utf8');
(async()=>{
 let checks=0;
 for(const existing of [false,true]) {
  let handler,awaited,closed=false,navigated='',focused=false,opened='';
  const scope='https://example.test/study/';
  const client={url:scope+'index.html#/settings',navigate:async url=>{navigated=url;},focus:async()=>{focused=true;}};
  const unrelated={url:'https://example.test/another-app/',navigate:()=>assert.fail('unrelated app must stay untouched')};
  const self={registration:{scope},addEventListener:(name,fn)=>{assert.equal(name,'notificationclick');handler=fn;},
   clients:{matchAll:async()=>existing?[unrelated,client]:[unrelated],openWindow:async url=>{opened=url;}}};
  vm.runInNewContext(source,{self,URL});
  handler({notification:{close:()=>{closed=true;}},waitUntil:promise=>{awaited=promise;}});await awaited;
  assert.ok(closed);checks++;
  const target=scope+'index.html#/practice?start=1&size=3';
  if(existing){assert.equal(navigated,target);assert.ok(focused);assert.equal(opened,'');checks+=3;}
  else{assert.equal(opened,target);assert.equal(navigated,'');checks+=2;}
 }
 console.log('Reminder worker:',checks,'checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
