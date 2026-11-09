const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:400,height:800},acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
const bb=await p.locator('#stage').boundingBox();const X=f=>bb.x+bb.width*f,Y=f=>bb.y+bb.height*f;
const path=[[.8,.2],[.2,.21],[.19,.7],[.8,.71]];
await p.mouse.move(X(path[0][0]),Y(path[0][1]));await p.mouse.down();
for(let i=1;i<path.length;i++)for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}
await p.mouse.up();await p.click('button[data-act=traceDone]');await p.waitForTimeout(300);
console.log('chips',await p.locator('.wchip').count());
await p.screenshot({path:'out/o1.png'});
await p.click('button[data-act=wallDel]');await p.click('button[data-act=wallDel]');await p.waitForTimeout(200);
console.log('chips after del',await p.locator('.wchip').count());
await p.screenshot({path:'out/o2.png'});
await p.click('.tab[data-v=walls]');await p.click('button[data-act=markAdd][data-o=h]');await p.click('button[data-act=markAdd][data-o=v]');await p.waitForTimeout(200);
await p.screenshot({path:'out/o3.png'});
await p.click('.tab[data-v=export]');
const [d]=await Promise.all([p.waitForEvent('download'),p.click('button[data-act=expPdf][data-v=all]')]);await d.saveAs('out/o.pdf');
console.log(errs.length?errs:'no errors');await b.close();})();
