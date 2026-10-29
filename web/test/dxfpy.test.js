const fs=require('fs'),cp=require('child_process');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {newRoom,buildDxf};')();
const cases={
 L:{pts:[[0,0],[0,5520],[1810,5520],[1810,6120],[2760,6120],[2760,5520],[3560,5520],[3560,8430],[9130,8430],[9130,0]],wt:[]},
 wall200:{pts:[[0,0],[0,3000],[3000,3000],[3000,0]],wt:[0,0,200,0]},
 aligned:{pts:[[0,0],[0,3000],[1500,3000],[3000,3000],[3000,0]],wt:[]},
 ccw:{pts:[[0,0],[3000,0],[3000,3000],[0,3000]],wt:[]},
};
for(const [k,c] of Object.entries(cases)){
  const r=E.newRoom('x',3000,3000,2700);r.pts=c.pts;r.wsrc=c.pts.map(()=>null);r.items=[];r.drains=[];r.wt=c.wt;
  const mine=E.buildDxf({rooms:[r]},0);
  const th=c.pts.map((_,i)=>c.wt[i]||120);
  cp.execFileSync('python3',['/tmp/ref.py',JSON.stringify(c.pts),JSON.stringify(th),'/tmp/ref_'+k+'.dxf']);
  const ref=fs.readFileSync('/tmp/ref_'+k+'.dxf','utf8');
  const lines=s=>{const L=s.split('\r\n');const o=[];for(let i=0;i<L.length;i++)if(L[i]==='LINE'){const g={};for(let j=i+1;L[j].trim()!=='0'&&j<L.length;j+=2)g[L[j].trim()]=+L[j+1];const a=[g[10],g[20]],b=[g[11],g[21]];o.push((a[0]<b[0]||(a[0]==b[0]&&a[1]<b[1])?[...a,...b]:[...b,...a]).join(','))}return o.sort()};
  const A=lines(ref),B=lines(mine);
  console.log(k,'ref',A.length,'mine',B.length,'diff',A.filter(x=>!B.includes(x)).length,B.filter(x=>!A.includes(x)).length,'header same',ref.split('ENTITIES')[0].replace(/TG_PAREDES/g,'')===mine.split('ENTITIES')[0].replace(/TG_PAREDES/g,''));
}
