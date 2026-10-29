const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:800}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await p.goto('file:///home/claude/tegora/out/index.html');await p.waitForTimeout(500);
await p.screenshot({path:'/home/claude/tegora/out/s1.png'});
for(const t of ['walls','ceil','photos','export']){await p.click(`.tab[data-v=${t}]`);await p.waitForTimeout(200);await p.screenshot({path:`/home/claude/tegora/out/s-${t}.png`});}
console.log(errs.join('\n')||'no errors');await b.close();})();
