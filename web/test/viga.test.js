const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:420,height:860},acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
const bb=await p.locator('#stage').boundingBox();const X=f=>bb.x+bb.width*f,Y=f=>bb.y+bb.height*f;
const path=[[.2,.1],[.8,.1],[.8,.5],[.2,.5],[.2,.1]];
await p.mouse.move(X(.2),Y(.1));await p.mouse.down();
for(let i=1;i<path.length;i++)for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}
await p.mouse.up();await p.waitForTimeout(300);if(await p.locator('button[data-act=traceDone]').count())await p.click('button[data-act=traceDone]');await p.waitForTimeout(300);
await p.click('.tab[data-v=ceil]');await p.waitForTimeout(200);
await p.click('button[data-act=cNewRoom]');await p.waitForTimeout(100);
await p.click('button[data-act=cNewSanca]');await p.waitForTimeout(200);
// drag sanca far to the right
const f=await p.locator('[data-id^="f:"]').last().boundingBox();
await p.mouse.move(f.x+f.width/2,f.y+f.height/2);await p.mouse.down();await p.mouse.move(f.x+f.width/2+400,f.y+f.height/2-400,{steps:8});await p.mouse.up();await p.waitForTimeout(200);
await p.click('button[data-act=bFree]');await p.waitForTimeout(100);
await p.mouse.move(X(.25),Y(.31));await p.mouse.down();await p.mouse.move(X(.5),Y(.3),{steps:6});await p.mouse.move(X(.75),Y(.31),{steps:6});await p.mouse.up();await p.waitForTimeout(300);
await p.screenshot({path:'out/v1.png'});
console.log('beams',await p.evaluate(()=>JSON.stringify(S.clients[0].rooms[0].beams)));
console.log('sanca',await p.evaluate(()=>JSON.stringify(S.clients[0].rooms[0].ceil.filter(e=>e.sanca).map(e=>[e.x,e.y,e.w,e.h]))), await p.evaluate(()=>JSON.stringify(S.clients[0].rooms[0].pts)));
await p.click('.tab[data-v=export]');
const [d]=await Promise.all([p.waitForEvent('download'),p.click('button[data-act=expPdf][data-v=all]')]);await d.saveAs('out/v.pdf');
console.log(errs.length?errs:'no errors');await b.close();})();
