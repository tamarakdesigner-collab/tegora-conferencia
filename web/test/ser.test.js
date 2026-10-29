const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1000,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.addInitScript(()=>{
  let q=[],wait=null;const wr=[];
  window.__feed=a=>{q.push(Uint8Array.from(a));if(wait){wait(q.shift());wait=null}};
  window.__wr=()=>wr;
  const port={open:async()=>{},close:async()=>{},writable:{getWriter:()=>({write:async v=>wr.push(Array.from(v)),releaseLock(){}})},readable:{getReader:()=>({cancel(){},read:()=>q.length?Promise.resolve({value:q.shift(),done:false}):new Promise(r=>{wait=v=>r({value:v,done:false})})})}};
  Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>port},configurable:true});
});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(300);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(100);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(100);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(200);
await p.click('.tab[data-v=export]');await p.waitForTimeout(150);
await p.click('button[data-act=conectarSerial]');await p.waitForTimeout(200);
console.log('written',await p.evaluate(()=>window.__wr()));
// frame real do fórum: C0551006080208E09CE93F000000000000000006 (1.825 m) em dois pedaços, com lixo antes
const fr=[0xC0,0x55,0x10,0x06,0x08,0x02,0x08,0xE0,0x9C,0xE9,0x3F,0,0,0,0,0,0,0,0,0x06];
await p.evaluate(a=>{window.__feed([0x00,0x04]);window.__feed(a.slice(0,7));window.__feed(a.slice(7))},fr);await p.waitForTimeout(300);
console.log(await p.locator('#btdiag').innerText());
console.log(errs.join('\n')||'no errors');await b.close();})();
