const fs=require('fs');const r=f=>fs.readFileSync('/home/claude/tegora/src/'+f,'utf8');
const js=['core.js','gfx.js','logo.js','draw.js','pdf.js','dxf.js','ui.js'].map(r).join('\n');
if(js.includes('</script'))throw new Error('script close in js');
let html=r('shell.html').replace('/*CSS*/',()=>r('app.css')).replace('/*JS*/',()=>js);
fs.writeFileSync('/home/claude/tegora/out/index.html',html);
console.log('index.html',html.length);
