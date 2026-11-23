const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:420,height:860},hasTouch:false});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(400);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(150);
await p.fill('#roomNames','Sala\nQuarto');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(150);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(250);
const bb=await p.locator('#stage').boundingBox();const X=f=>bb.x+bb.width*f,Y=f=>bb.y+bb.height*f;
const path=[[.2,.1],[.8,.1],[.8,.5],[.2,.5],[.2,.1]];
await p.mouse.move(X(.2),Y(.1));await p.mouse.down();
for(let i=1;i<path.length;i++)for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}
await p.mouse.up();await p.waitForTimeout(300);if(await p.locator('button[data-act=traceDone]').count())await p.click('button[data-act=traceDone]');await p.waitForTimeout(300);
// edit wall length
const inp=p.locator('input[data-act=wallLen]').first();
await inp.fill('3500');await inp.press('Tab');await p.waitForTimeout(300);
console.log('lock icons',await p.locator('.lk').count(),'readonly',await p.locator('input[data-act=wallLen][readonly]').count());
await p.locator('.lk').first().click();await p.waitForTimeout(200);
console.log('after unlock icons',await p.locator('.lk').count());
await p.click('.tab[data-v=plan]').catch(()=>{});
// back to client, long press room 1
await p.click('#back, [data-act=back]');await p.waitForTimeout(250);
const card=p.locator('button[data-act=roomOpen][data-i="1"]');const bx=await card.boundingBox();
await p.mouse.move(bx.x+20,bx.y+15);await p.mouse.down();await p.waitForTimeout(800);await p.mouse.up();await p.waitForTimeout(200);
console.log('menu',await p.locator('.mdlb').innerText());
await p.click('button[data-act=rmLock]');await p.waitForTimeout(150);
console.log('lock badge',await p.locator('button[data-act=roomOpen][data-i="1"] svg').count());
await p.mouse.move(bx.x+20,bx.y+15);await p.mouse.down();await p.waitForTimeout(800);await p.mouse.up();await p.waitForTimeout(200);
console.log('locked menu has delete?',await p.locator('button[data-act=rmDel1]').count());
await p.click('button[data-act=rmLock]');await p.waitForTimeout(150);
await p.mouse.move(bx.x+20,bx.y+15);await p.mouse.down();await p.waitForTimeout(800);await p.mouse.up();await p.waitForTimeout(200);
await p.click('button[data-act=rmDel1]');await p.click('button[data-act=rmDel2]');await p.click('button[data-act=rmDelGo]');await p.waitForTimeout(200);
console.log('rooms left',await p.locator('button[data-act=roomOpen]').count());
console.log(errs.length?errs:'no errors');await b.close();})();
