// Gera src/logo.js a partir do SVG da marca (vetor), para desenhar o logotipo na tela e no PDF.
const fs = require('fs');
const svg = fs.readFileSync(process.argv[2], 'utf8');
const vb = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
const items = [];
const re = /<(path|rect)\b([^>]*)\/>/g; let m;
const fill2key = { '#2A2826': 'ink', '#9C7A48': 'gold', '#6C665D': 'gray' };
while ((m = re.exec(svg))) {
  const at = a => { const r = new RegExp(a + '="([^"]+)"').exec(m[2]); return r && r[1]; };
  const f = fill2key[at('fill')] || 'ink';
  if (m[1] === 'path') items.push({ d: at('d'), f });
  else items.push({ r: [+at('x'), +at('y'), +at('width'), +at('height')], f });
}
const out = `/* gerado por build/mklogo.js a partir de ${process.argv[2].split('/').pop()} */\nconst LOGO = ${JSON.stringify({ vb, markX1: 375.5, items })};\n`;
fs.writeFileSync('src/logo.js', out);
console.log('logo', items.length, 'itens', out.length, 'bytes');
