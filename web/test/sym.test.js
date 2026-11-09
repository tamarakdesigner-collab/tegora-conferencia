const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:420,height:860},acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
const bb=await p.locator('#stage').boundingBox();const X=f=>bb.x+bb.width*f,Y=f=>bb.y+bb.height*f;
const path=[[.2,.2],[.8,.2],[.8,.7],[.2,.7],[.2,.2]];
await p.mouse.move(X(.2),Y(.2));await p.mouse.down();
for(let i=1;i<path.length;i++)for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}
await p.mouse.up();await p.waitForTimeout(300);if(await p.locator('button[data-act=traceDone]').count())await p.click('button[data-act=traceDone]');await p.waitForTimeout(300);
await p.click('.tab[data-v=walls]');await p.waitForTimeout(200);
for(const [cat,t] of [['esq','porta-giro'],['ele','tomada'],['ele','tomada2'],['hid','af'],['hid','bacia'],['cor','coringa']]){
  await p.click(`button[data-act=libCat][data-v=${cat}]`);await p.click(`button[data-act=libAdd][data-t=${t}]`);await p.waitForTimeout(150);}
await p.waitForTimeout(300);await p.screenshot({path:'out/s1.png'});
console.log(errs.length?errs:'no errors');await b.close();})();
