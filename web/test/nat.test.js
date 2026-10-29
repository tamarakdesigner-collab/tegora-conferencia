const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1000,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.addInitScript(()=>{
  const sent=[];window.__sent=sent;window.__saved=[];
  window.TegoraNative={paired:()=>JSON.stringify({devices:[{name:'Galaxy Buds',address:'AA'},{name:'Bosch GLM50C x0889',address:'00:11'}]}),
    connect:a=>{sent.push('connect '+a);setTimeout(()=>window.__natState('on'),50)},send:h=>sent.push('send '+h),disconnect:()=>sent.push('disc'),
    save:(n,b)=>window.__saved.push([n,b.length])};
});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(300);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(100);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(100);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(200);
await p.click('#bt');await p.waitForTimeout(600);
console.log(await p.evaluate(()=>window.__sent));
// frame real do print da usuária, em 3 pedaços (hex)
await p.evaluate(()=>{const h='C05510060850002506D93F000000000000000000B2'.slice(0,40);window.__natRx('0010');window.__natRx('C0551006085000');window.__natRx('2506D93F00000000000000000B2'.slice(0,26))});
await p.waitForTimeout(200);
await p.click('.tab[data-v=export]');await p.waitForTimeout(150);
console.log((await p.locator('#btdiag').innerText()).split('\n').slice(0,12).join('\n'));
await p.click('button[data-act=expJson]').catch(()=>{});await p.waitForTimeout(500);
console.log('saved',await p.evaluate(()=>window.__saved));
console.log(errs.join('\n')||'no errors');await b.close();})();
