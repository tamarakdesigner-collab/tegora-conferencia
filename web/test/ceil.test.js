const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:400,height:800},acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load/.test(m.text()))errs.push('CONSOLE '+m.text())});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','Teste');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
await p.screenshot({path:'out/e0.png'});
const bb=await p.locator('#stage').boundingBox();
const X=f=>bb.x+bb.width*f, Y=f=>bb.y+bb.height*f;
async function stroke(path){await p.mouse.move(X(path[0][0]),Y(path[0][1]));await p.mouse.down();
for(let i=1;i<path.length;i++){for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}}await p.mouse.up();await p.waitForTimeout(250);}
await stroke([[.15,.15],[.85,.15],[.85,.75],[.15,.75],[.15,.15]]);
await p.screenshot({path:'out/e1.png'});
console.log('sheet h after draw',await p.locator('#sheet').evaluate(e=>e.style.height));
// tap a wall to open
await p.click('.tab[data-v=ceil]');await p.waitForTimeout(200);
await p.click('button[data-act=cNewRoom]');await p.waitForTimeout(200);
await p.selectOption('select[data-act=cTrim]','neg');await p.waitForTimeout(150);
await p.fill('input[data-act=cNh]','2900');await p.press('input[data-act=cNh]','Tab');await p.waitForTimeout(150);
await p.click('details summary');await p.fill('input[data-act=cEo][data-k="0"]','350');await p.press('input[data-act=cEo][data-k="0"]','Tab');await p.waitForTimeout(200);
await p.screenshot({path:'out/e2.png'});
await p.click('button[data-act=cFree][data-v=sanca]');await p.waitForTimeout(100);
await stroke([[.3,.35],[.6,.35],[.6,.55],[.3,.55],[.3,.35]]);
await p.screenshot({path:'out/e3.png'});
console.log('ceil items',await p.locator('.list button[data-act=cSel]').count());
await p.click('.tab[data-v=walls]');await p.waitForTimeout(200);await p.screenshot({path:'out/e4.png'});
await p.click('.tab[data-v=photos]');await p.waitForTimeout(150);
console.log('capture input',await p.locator('input[capture]').count());
await p.click('.tab[data-v=export]');
const [d1]=await Promise.all([p.waitForEvent('download'),p.click('button[data-act=expPdf][data-v=all]')]);await d1.saveAs('out/e.pdf');
console.log(errs.join('\n')||'no errors');await b.close();})();
