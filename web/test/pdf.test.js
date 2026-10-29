const fs=require('fs');
const code=fs.readFileSync('/home/claude/tegora/out/engine.js','utf8');
const E=new Function(code+';return {sampleState,projOf,buildPdf,buildDxf,setUnit,makeZip};')();
const st=E.sampleState();const c=st.clients[0];
const pr=E.projOf(c,'mm');
const pdf=E.buildPdf(pr,{});fs.writeFileSync('/home/claude/tegora/out/t.pdf',pdf);console.log('pdf',pdf.length);
const dx=E.buildDxf(pr,0);fs.writeFileSync('/home/claude/tegora/out/dxf/d.dxf',dx);console.log('dxf',dx.length);
