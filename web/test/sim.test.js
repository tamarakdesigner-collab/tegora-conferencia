const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {sampleState,projOf,buildPdf,makeItem,wallOrder,wallLen};')();
const st=E.sampleState();const c=st.clients[0];const r=c.rooms[0];
const wi=E.wallOrder(r)[4];const L=E.wallLen(r,wi);
r.items=r.items.filter(i=>i.wall!==wi);r.lk={};
const spec=[['af',0.14,447,1,1],['esg',0.20,317,1,1],['aq',0.22,456,0,0],['tomada',0.43,1231,1,1],['af',0.74,439,1,1],['esg',0.80,314,1,0],['aq',0.84,435,0,0],['registro',0.9,1100,1,1]];
for(const [t,f,z,mu,mz] of spec){const it=E.makeItem(t,wi,r);it.u=Math.round(L*f);it.z=z;r.items.push(it);if(mu)r.lk['itUL|id='+it.id]=(t==='af'&&f>0.5)||t==='registro'?'itUR':'itUL';if(mz)r.lk['itZ|id='+it.id]=true;}
const pdf=E.buildPdf(E.projOf(c,'mm'),{});fs.writeFileSync('/home/claude/tegora/out/sim.pdf',pdf);
