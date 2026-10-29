const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:400,height:800},acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|ERR_|Failed to load/.test(m.text()))errs.push('CONSOLE '+m.text())});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');
await p.fill('[data-f=nome]','Teste');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
await p.screenshot({path:'out/d0.png'});
const bb=await p.locator('#stage').boundingBox();
const X=f=>bb.x+bb.width*f, Y=f=>bb.y+bb.height*f;
// clockwise-ish wobbly L shape
const path=[[.15,.2],[.5,.21],[.52,.45],[.85,.44],[.86,.8],[.14,.79],[.15,.2]];
await p.mouse.move(X(path[0][0]),Y(path[0][1]));await p.mouse.down();
for(let i=1;i<path.length;i++){for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8+(Math.random()-.5)*.01),Y(a[1]+(c[1]-a[1])*t/8+(Math.random()-.5)*.01));}}
await p.mouse.up();await p.waitForTimeout(300);
await p.screenshot({path:'out/d1.png'});
console.log('walls chips',await p.locator('.wchip').count());
// drag first corner
const c0=await p.locator('[data-id="c:0"]').boundingBox();
await p.mouse.move(c0.x+c0.width/2,c0.y+c0.height/2);await p.mouse.down();await p.mouse.move(c0.x+c0.width/2+25,c0.y+c0.height/2+20,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
await p.screenshot({path:'out/d2.png'});
await p.click('.tab[data-v=export]');
const [d2]=await Promise.all([p.waitForEvent('download'),p.click('button[data-act=expDxf][data-v=all]')]);await d2.saveAs('out/d-dxf.zip');
console.log(errs.join('\n')||'no errors');await b.close();})();
