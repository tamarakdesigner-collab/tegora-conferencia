const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:400,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.addInitScript(()=>{
  const listeners=[];let written=null;
  const ch={properties:{indicate:true,write:true,writeWithoutResponse:true},addEventListener:(t,f)=>listeners.push(f),startNotifications:async()=>ch,writeValueWithoutResponse:async v=>{written=Array.from(v)}};
  window.__written=()=>written;
  window.__emit=bytes=>{const dv=new DataView(Uint8Array.from(bytes).buffer);listeners.forEach(f=>f({target:{value:dv}}))};
  navigator.bluetooth={requestDevice:async o=>({addEventListener(){},gatt:{connected:true,connect:async()=>({getPrimaryService:async u=>({getCharacteristic:async c=>ch})}),disconnect(){}}})};
});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(300);
await p.click('button[data-act=clientForm]');await p.fill('[data-f=nome]','T');await p.click('button[data-act=clientNew]');await p.waitForTimeout(100);
await p.fill('#roomNames','Sala');await p.click('button[data-act=roomsCreate]');await p.waitForTimeout(100);
await p.click('button[data-act=roomOpen][data-i="0"]');await p.waitForTimeout(200);
const bb=await p.locator('#stage').boundingBox();const X=f=>bb.x+bb.width*f,Y=f=>bb.y+bb.height*f;
const path=[[.15,.15],[.85,.15],[.85,.75],[.15,.75],[.15,.15]];
await p.mouse.move(X(.15),Y(.15));await p.mouse.down();for(let i=1;i<path.length;i++)for(let t=1;t<=8;t++){const a=path[i-1],c=path[i];await p.mouse.move(X(a[0]+(c[0]-a[0])*t/8),Y(a[1]+(c[1]-a[1])*t/8));}await p.mouse.up();await p.waitForTimeout(300);
await p.click('#bt');await p.waitForTimeout(200);
console.log('chip',await p.locator('#bt').textContent(),'cmd',await p.evaluate(()=>window.__written()));
await p.click('button.meas >> nth=0');await p.waitForTimeout(100);
const f32=m=>{const a=new Uint8Array(new Float32Array([m]).buffer);return Array.from(a)};
await p.evaluate(b=>window.__emit(b),[0xC0,0x55,0x10,0x06,0,0,0,...f32(2.345),0]);await p.waitForTimeout(300);
const vals=await p.locator('input[data-act=wallLen]').inputValue();console.log('wallLen after reading',vals);
await p.click('.tab[data-v=export]');await p.waitForTimeout(200);
console.log(await p.locator('#btdiag').innerText());
console.log(errs.join('\n')||'no errors');await b.close();})();
