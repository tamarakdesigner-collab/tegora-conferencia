const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {sampleState,projOf,buildPdf,setUnit};')();
const st=E.sampleState();const c=st.clients[0];const r=c.rooms[0];
// escada pequena com recortes, parecido com a foto
r.pts=[[0,0],[0,1400],[1000,1400],[1000,2300],[1420,2300],[1420,2900],[2300,2900],[2300,3800],[3200,3800],[3200,0]];
r.wn=undefined;r.wsrc=r.pts.map(()=>null);r.wt=[];r.wd=[];r.marks=[];r.items=[];r.ceil=[];r.beams=[];r.drains=[];
const pdf=E.buildPdf(E.projOf(c,'mm'),{});fs.writeFileSync('/home/claude/tegora/out/s.pdf',pdf);
