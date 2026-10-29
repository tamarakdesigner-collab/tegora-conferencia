const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {newRoom,makeItem,projOf,newClient,buildPdf};')();
const r=E.newRoom('Teste',3000,3000,2550);
const add=(t,u,z)=>{const it=E.makeItem(t,0,r);it.u=u;it.z=z;r.items.push(it)};
add('tomada',830,665);add('tomada2',1840,665);add('tomada',2030,660);add('interfone',2030,1500);add('af',2600,500);add('esg',2700,500);
const c=E.newClient({nome:'Cliente Teste',rooms:[r]});
fs.writeFileSync('/home/claude/tegora/out/dim.pdf',E.buildPdf(E.projOf(c,'mm'),{}));
