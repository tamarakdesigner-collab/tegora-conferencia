const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {newRoom,buildDxf,makeItem,newDrain};')();
const ents=s=>{const L=s.split('\r\n');const out=[];let cur=null;for(let i=0;i<L.length;i++){const t=L[i].trim();if(i%2===0&&L[i].length===3&&['LINE','ARC','CIRCLE'].includes(L[i+1])&&t==='0'){cur={t:L[i+1],g:{}};out.push(cur);}else if(cur&&i%2===0&&t!=='0'&&t!==''){cur.g[+t]=isNaN(+L[i+1])?L[i+1]:+L[i+1];}else if(i%2===0&&t==='0'&&!['LINE','ARC','CIRCLE'].includes(L[i+1]))cur=null;}return out};
function chk(name,r){
  const dx=E.buildDxf({rooms:[r]},0);
  const bareLF=/[^\r]\n/.test(dx);
  const bad=/(LWPOLYLINE|POLYLINE|TEXT|INSERT|HATCH|BLOCKS|CLASSES|OBJECTS|\n  5\r|330|AcDb)/.test(dx);
  const e=ents(dx);
  const xs=e.filter(q=>q.t==='LINE').flatMap(q=>[q.g[10],q.g[11]]),ys=e.filter(q=>q.t==='LINE').flatMap(q=>[q.g[20],q.g[21]]);
  console.log(name,'bareLF',bareLF,'forbidden',bad,'ents',e.length,'x',Math.min(...xs),Math.max(...xs),'y',Math.min(...ys),Math.max(...ys),'comma',/\d,\d/.test(dx),'sci',/e[+-]\d/.test(dx));
  return {dx,e};
}
let r=E.newRoom('Q',3000,3000,2700);r.items=[];chk('quadrado',r);
r=E.newRoom('Q',3000,3000,2700);r.wt=[0,0,200,0];r.items=[];chk('parede200',r);
r=E.newRoom('P',4000,3000,2700);
const door=E.makeItem('porta-giro',0,r);door.wall=0;door.u=500;door.w=800;door.swing='in';door.hinge='L';
const win=E.makeItem('janela',1,r);win.wall=1;win.u=700;win.w=1200;
r.items=[door,win];r.drains=[Object.assign(E.newDrain(r),{x:2000,y:1500})];
const {dx,e}=chk('porta+janela+ralo',r);
console.log(e.filter(q=>q.t!=='LINE').map(q=>JSON.stringify(q)).join('\n'));
const byL={};e.forEach(q=>byL[q.g[8]]=(byL[q.g[8]]||0)+1);console.log(byL);
fs.writeFileSync('out/dxf/spec.dxf',dx);
// exporta casos para validar_dxf
{const w=(n,r)=>fs.writeFileSync('/tmp/v_'+n+'.dxf',E.buildDxf({rooms:[r]},0));
 let a=E.newRoom('Q',3000,3000,2700);a.items=[];w('quad',a);
 w('porta',r);
 const L=E.newRoom('L',3000,3000,2700);L.pts=[[0,0],[0,5520],[1810,5520],[1810,6120],[2760,6120],[2760,5520],[3560,5520],[3560,8430],[9130,8430],[9130,0]];L.wsrc=L.pts.map(()=>null);L.items=[];w('L',L);}
