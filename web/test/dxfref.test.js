const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {newRoom,buildDxf};')();
const r=E.newRoom('T',3000,3000,2700);
// pontos do modelo (sentido horário, y para cima), origem no canto interno
r.pts=[[0,0],[0,5520],[1810,5520],[1810,6120],[2760,6120],[2760,5520],[3560,5520],[3560,8430],[9130,8430],[9130,0]];
r.wsrc=r.pts.map(()=>null);r.items=[];r.drains=[];
const dx=E.buildDxf({rooms:[r]},0);fs.writeFileSync('out/dxf/ref.dxf',dx);
const lines=s=>{const L=s.split('\n').map(x=>x.trim());const out=[];for(let i=0;i<L.length;i++)if(L[i]==='LINE'){const g={};for(let j=i+1;j<L.length&&L[j]!=='0';j+=2)g[L[j]]=+L[j+1];out.push([g[10],g[20],g[11],g[21]].join(','));}return out};
const ref=lines(fs.readFileSync('/mnt/user-data/attachments/164a54f7-f7e9-585d-a725-8b8dbed33227/25a9c0f4-teste_gerador_app.dxf','utf8'));
const mine=lines(dx);
const norm=a=>a.map(l=>{const p=l.split(',').map(Number);return (p[0]<p[2]||(p[0]==p[2]&&p[1]<p[3]))?p.join(','):[p[2],p[3],p[0],p[1]].join(',')}).sort();
const A=norm(ref),B=norm(mine);
console.log('ref',A.length,'mine',B.length,'missing',A.filter(x=>!B.includes(x)),'extra',B.filter(x=>!A.includes(x)));
