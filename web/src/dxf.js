/* ===== Tégora · DXF da planta baixa no formato do arquivo-modelo (AutoCAD R12 / AC1009, CRLF, camadas TG_*) =====
   Igual ao modelo enviado: cabeçalho mínimo, uma tabela de layers e só entidades LINE
   (mais ARC e CIRCLE nas esquadrias e ralos). Sem handles, polilinhas, textos, cotas, blocos ou hachuras. */
'use strict';

const DXF_LAYERMAP = { TG_PAREDES: 'TG_PAREDES', TG_ESQUADRIAS: 'TG_ESQUADRIAS', TG_HIDRAULICA: 'TG_HIDRAULICA' };
const DXF_COLORS = { TG_PAREDES: 7, TG_ESQUADRIAS: 7, TG_HIDRAULICA: 7 };
const dn = x => { const s = (Math.round(x * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' || s === '' ? '0' : s; };
const gc = (code, v) => String(code).padStart(3, ' ') + '\n' + v + '\n';

class DxfG {
  constructor() { this.o = []; this.cur = 'TG_PAREDES'; this.skip = 0; this.hit = false; this.used = new Set(); }
  layer(n) { if (n) this.cur = DXF_LAYERMAP[n] || null; }
  _off() { return this.skip > 0 || !this.cur; }
  _line(x1, y1, x2, y2) {
    this.used.add(this.cur);
    this.o.push(gc(0, 'LINE') + gc(8, this.cur) + gc(10, dn(x1)) + gc(20, dn(-y1)) + gc(30, 0) + gc(11, dn(x2)) + gc(21, dn(-y2)) + gc(31, 0));
  }
  _loop(pts, closed) {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.01) this._line(a[0], a[1], b[0], b[1]); }
  }
  line(x1, y1, x2, y2, o) { if (this._off() || !(o && o.stroke && o.stroke !== 'none')) return; this._line(x1, y1, x2, y2); }
  _draws(o) {
    if (this._off() || !o) return false;
    if (o.stroke && o.stroke !== 'none') return true;
    return o.fill === '#2A2826' || (o.fill === '#FFFFFF' && this.cur === 'TG_PAREDES');
  }
  rect(x, y, w, h, o) { if (this._draws(o)) this._loop([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }
  poly(pts, o) { if (this._draws(o)) this._loop(pts, o.close !== false); }
  circle(cx, cy, r, o) {
    if (this._off() || !(o && o.stroke && o.stroke !== 'none')) return;
    this.used.add(this.cur);
    this.o.push(gc(0, 'CIRCLE') + gc(8, this.cur) + gc(10, dn(cx)) + gc(20, dn(-cy)) + gc(30, 0) + gc(40, dn(r)));
  }
  arc(cx, cy, r, a0, a1) {
    if (this._off()) return;
    const n = a => ((a % 360) + 360) % 360;
    this.used.add(this.cur);
    this.o.push(gc(0, 'ARC') + gc(8, this.cur) + gc(10, dn(cx)) + gc(20, dn(-cy)) + gc(30, 0) + gc(40, dn(r)) + gc(50, dn(n(a0))) + gc(51, dn(n(a1))));
  }
  text() { }
  path() { }
  image() { }
  clipPoly() { this.skip++; }
  clipRect() { this.skip++; }
  unclip() { this.skip--; }
  hitLine() { } hitRect() { }
  sym() { }
}

function dxfDoc(entities, used) {
  const names = Object.keys(DXF_COLORS).filter(n => used.has(n));
  if (!names.length) names.push('TG_PAREDES');
  let s = gc(0, 'SECTION') + gc(2, 'HEADER') + gc(9, '$ACADVER') + gc(1, 'AC1009') + gc(9, '$INSUNITS') + gc(70, 4) + gc(0, 'ENDSEC');
  s += gc(0, 'SECTION') + gc(2, 'TABLES') + gc(0, 'TABLE') + gc(2, 'LAYER') + gc(70, names.length);
  for (const n of names) s += gc(0, 'LAYER') + gc(2, n) + gc(70, 0) + gc(62, DXF_COLORS[n]) + gc(6, 'CONTINUOUS');
  s += gc(0, 'ENDTAB') + gc(0, 'ENDSEC');
  s += gc(0, 'SECTION') + gc(2, 'ENTITIES') + entities + gc(0, 'ENDSEC') + gc(0, 'EOF');
  return s.replace(/\n/g, '\r\n'); /* CRLF em toda linha; termina em EOF+CRLF, sem linha depois (senão o Promob trava) */
}

/* Um ambiente por arquivo, somente a planta baixa. 1 unidade = 1 mm, origem no canto inferior esquerdo. */
function buildDxf(state, ri) {
  const G = new DxfG();
  const room = state.rooms[ri], b = bbox(room.pts);
  drawPlan({ G, v: new View(1, -b.x0, b.y0), K: 6, P: PAL_PRINT, hit: false }, room, {});
  return dxfDoc(G.o.join(''), G.used);
}

/* Mesmas checagens do validar_dxf da especificação; retorna a lista de problemas (vazia = ok) */
function validarDxf(s) {
  const er = [];
  if (/[^\x00-\x7f]/.test(s)) er.push('caracteres fora do ASCII');
  if ((s.match(/\n/g) || []).length !== (s.match(/\r\n/g) || []).length || (s.match(/\r/g) || []).length !== (s.match(/\r\n/g) || []).length) er.push('quebra de linha que nao e CRLF');
  if (!s.endsWith('\r\nEOF\r\n')) er.push('o arquivo deve terminar exatamente em EOF + CRLF');
  const L = s.split('\r\n').slice(0, -1);
  if (L.length % 2) er.push('numero impar de linhas');
  const vals = new Set();
  for (let i = 0; i + 1 < L.length; i += 2) {
    if (!/^-?\d+$/.test(L[i].trim())) { er.push('codigo de grupo invalido na linha ' + (i + 1)); break; }
    if (L[i + 1].trim() === '') { er.push('valor vazio'); break; }
    if (L[i].trim() === '0') vals.add(L[i + 1]);
  }
  for (const p of ['POLYLINE', 'LWPOLYLINE', 'TEXT', 'MTEXT', 'INSERT', 'DIMENSION', 'HATCH', 'SPLINE', 'ELLIPSE']) if (vals.has(p)) er.push('entidade nao permitida: ' + p);
  return er;
}
