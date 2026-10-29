/* ===== Tégora · núcleo: unidades, geometria, modelo de dados ===== */
'use strict';

/* ---------- Unidades ---------- */
const UNITS = { mm: { f: 1, dec: 0 }, cm: { f: 10, dec: 1 }, m: { f: 1000, dec: 3 } };
let UNIT = 'mm';
function setUnit(u) { if (UNITS[u]) UNIT = u; }

function fmt(mm, unit, withUnit) {
  unit = unit || UNIT;
  const u = UNITS[unit];
  let s = (mm / u.f).toFixed(u.dec);
  let neg = s[0] === '-';
  if (neg) s = s.slice(1);
  let [i, d] = s.split('.');
  if (unit === 'mm') i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  s = (neg ? '-' : '') + (d !== undefined ? i + ',' + d : i);
  return withUnit ? s + ' ' + unit : s;
}

function parseIn(str, unit) {
  unit = unit || UNIT;
  if (str == null) return NaN;
  let s = String(str).trim().replace(/\s/g, '').replace(/[a-zA-Zµ²³]/g, '');
  if (!s) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    if (unit === 'mm' || /,/.test(s)) s = s.replace(/\./g, '');
  }
  s = s.replace(',', '.');
  const v = parseFloat(s);
  if (!isFinite(v)) return NaN;
  return Math.round(v * UNITS[unit].f * 10) / 10;
}

/* ---------- Vetores ---------- */
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const vmul = (a, k) => [a[0] * k, a[1] * k];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1];
const vlen = a => Math.hypot(a[0], a[1]);
const vnorm = a => { const l = vlen(a) || 1e-9; return [a[0] / l, a[1] / l]; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (x, p) => { p = p || 1; return Math.round(x / p) * p; };
function uid(p) { return (p || 'i') + Math.random().toString(36).slice(2, 8); }

function area2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
/* Polígono sempre horário (y para cima): o interior fica à direita de cada parede */
function orientCW(pts) { return area2(pts) > 0 ? pts.slice().reverse() : pts; }

function wallGeom(room, i) {
  const n = room.pts.length;
  const A = room.pts[i], B = room.pts[(i + 1) % n];
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const L = Math.hypot(dx, dy) || 1e-9;
  const d = [dx / L, dy / L];
  return { A, B, L, d, nin: [d[1], -d[0]] };
}
function wallLen(room, i) { return wallGeom(room, i).L; }

function lineInter(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}
/* t > 0 desloca para dentro, t < 0 para fora (polígono horário) */
function offsetPoly(pts, t) {
  const n = pts.length, out = [];
  for (let j = 0; j < n; j++) {
    const p0 = pts[(j - 1 + n) % n], p1 = pts[j], p2 = pts[(j + 1) % n];
    const d1 = vnorm(vsub(p1, p0)), d2 = vnorm(vsub(p2, p1));
    const n1 = [d1[1], -d1[0]], n2 = [d2[1], -d2[0]];
    const a = vadd(p1, vmul(n1, t)), c = vadd(p1, vmul(n2, t));
    out.push(lineInter(a, d1, c, d2) || a);
  }
  return out;
}

function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
  }
  return inside;
}
function onPolyEdge(p, pts, tol) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ab = vsub(b, a), ap = vsub(p, a);
    const t = clamp(vdot(ap, ab) / (vdot(ab, ab) || 1), 0, 1);
    if (vlen(vsub(p, vadd(a, vmul(ab, t)))) <= tol) return true;
  }
  return false;
}
function insideRoom(p, pts, tol) { return onPolyEdge(p, pts, tol || 2) || pointInPoly(p, pts); }
function rectInsideRoom(x, y, w, h, pts) {
  if (w < 50 || h < 50) return false;
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (!c.every(p => insideRoom(p, pts))) return false;
  const e = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2], [x + w / 2, y + h / 2]];
  if (!e.every(p => insideRoom(p, pts))) return false;
  for (const p of pts) if (p[0] > x + 1 && p[0] < x + w - 1 && p[1] > y + 1 && p[1] < y + h - 1) return false;
  return true;
}
function bbox(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }
  return { x0: a, y0: b, x1: c, y1: d, w: c - a, h: d - b };
}
function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-6) { const b = bbox(pts); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }
  return [cx / (3 * a), cy / (3 * a)];
}

/* ---------- Biblioteca de símbolos ---------- */
const CATS = [
  { id: 'esq', name: 'Esquadrias', short: 'Esquadrias' },
  { id: 'ele', name: 'Elétrica', short: 'Elétrica' },
  { id: 'hid', name: 'Hidráulica', short: 'Hidráulica' },
  { id: 'ar', name: 'Ar condicionado', short: 'Ar cond.' },
  { id: 'cor', name: 'Coringa', short: 'Coringa' },
];
const LIB = [
  { id: 'porta-giro', cat: 'esq', kind: 'op', name: 'Porta de giro', tag: 'P', w: 800, h: 2100, z: 0, hinge: true },
  { id: 'porta-giro2', cat: 'esq', kind: 'op', name: 'Porta de giro 2 folhas', tag: 'P', w: 1500, h: 2100, z: 0, hidden: true },
  { id: 'porta-correr', cat: 'esq', kind: 'op', name: 'Porta de correr', tag: 'P', w: 1600, h: 2100, z: 0 },
  { id: 'janela', cat: 'esq', kind: 'op', name: 'Janela', tag: 'J', w: 1000, h: 1000, z: 1100 },
  { id: 'janela-correr', cat: 'esq', kind: 'op', name: 'Janela de correr', tag: 'J', w: 1500, h: 1000, z: 1100, hidden: true },
  { id: 'porta-janela', cat: 'esq', kind: 'op', name: 'Porta-janela', tag: 'PJ', w: 1500, h: 2100, z: 0 },
  { id: 'vao', cat: 'esq', kind: 'op', name: 'Vão livre', tag: 'V', w: 900, h: 2100, z: 0 },
  { id: 'tomada', cat: 'ele', kind: 'pt', name: 'Tomada', code: 'T', w: 100, h: 100, z: 1100 },
  { id: 'tomada2', cat: 'ele', kind: 'pt', name: 'Tomada dupla', code: 'T2', w: 100, h: 100, z: 1100 },
  { id: 'int-1', cat: 'ele', kind: 'pt', name: 'Interruptor', code: 'I', w: 100, h: 100, z: 1100 },
  { id: 'quadro', cat: 'ele', kind: 'pt', name: 'Quadro de distribuição', code: 'QD', w: 300, h: 400, z: 1500 },
  { id: 'interfone', cat: 'ele', kind: 'pt', name: 'Interfone', code: 'IF', w: 100, h: 100, z: 1500 },
  { id: 'af', cat: 'hid', kind: 'pt', name: 'Água fria', code: 'AF', w: 100, h: 100, z: 600 },
  { id: 'aq', cat: 'hid', kind: 'pt', name: 'Água quente', code: 'AQ', w: 100, h: 100, z: 600 },
  { id: 'esg', cat: 'hid', kind: 'pt', name: 'Esgoto', code: 'ES', w: 100, h: 100, z: 500 },
  { id: 'registro', cat: 'hid', kind: 'pt', name: 'Registro', code: 'RG', w: 100, h: 100, z: 1200 },
  { id: 'gas', cat: 'hid', kind: 'pt', name: 'Gás', code: 'G', w: 100, h: 100, z: 600 },
  { id: 'dreno', cat: 'ar', kind: 'pt', name: 'Caixa do dreno (ar)', code: 'DR', w: 280, h: 150, z: 2000, zb: true },
  { id: 'coringa', cat: 'cor', kind: 'pt', name: 'Ponto coringa', code: '?', w: 300, h: 300, z: 1000 },
  /* removidos da biblioteca (continuam desenhando em projetos antigos) */
  { id: 'tug-baixa', cat: 'ele', kind: 'pt', name: 'Tomada', code: 'T', w: 100, h: 100, z: 300, hidden: true },
  { id: 'tug-media', cat: 'ele', kind: 'pt', name: 'Tomada', code: 'T', w: 100, h: 100, z: 1100, hidden: true },
  { id: 'tug-bancada', cat: 'ele', kind: 'pt', name: 'Tomada', code: 'T', w: 100, h: 100, z: 1200, hidden: true },
  { id: 'tue', cat: 'ele', kind: 'pt', name: 'Tomada 220 V', code: 'TE', w: 100, h: 100, z: 300, hidden: true },
  { id: 'int-2', cat: 'ele', kind: 'pt', name: 'Interruptor duplo', code: 'I2', w: 100, h: 100, z: 1100, hidden: true },
  { id: 'dados', cat: 'ele', kind: 'pt', name: 'Dados / TV', code: 'D', w: 100, h: 100, z: 300, hidden: true },
  { id: 'arandela', cat: 'ele', kind: 'pt', name: 'Arandela', code: 'A', w: 100, h: 100, z: 1800, hidden: true },
  { id: 'torneira', cat: 'hid', kind: 'pt', name: 'Torneira', code: 'TO', w: 100, h: 100, z: 1100, hidden: true },
  { id: 'evap', cat: 'ar', kind: 'pt', name: 'Evaporadora', code: 'AC', w: 900, h: 300, z: 2100, hidden: true },
  { id: 'ac-ele', cat: 'ar', kind: 'pt', name: 'Elétrica do ar', code: 'EA', w: 100, h: 100, z: 2000, hidden: true },
  { id: 'ac-lf', cat: 'ar', kind: 'pt', name: 'Linha frigorífica', code: 'LF', w: 100, h: 100, z: 2000, hidden: true },
];
const LIBMAP = {};
LIB.forEach(t => { LIBMAP[t.id] = t; });

function makeItem(typeId, wall, room) {
  const t = LIBMAP[typeId];
  const L = wallLen(room, wall);
  const it = { id: uid('i'), wall, type: typeId, kind: t.kind, name: t.name, w: t.w, h: t.h, z: t.z, src: 'manual' };
  if (t.zb) it.zb = true;
  if (t.kind === 'op') {
    it.u = Math.max(0, rnd((L - t.w) / 2, 5));
    if (typeId === 'porta-giro') { it.hinge = 'L'; it.swing = 'in'; }
    if (typeId === 'porta-giro2') it.swing = 'in';
  } else {
    it.u = rnd(L / 2, 5);
    if (typeId === 'coringa') { it.color = '#7A5E36'; it.shape = 'rect'; }
  }
  return it;
}
/* caixa do item no plano da parede: u = borda esquerda (esquadria) ou centro (ponto); z = peitoril ou centro */
/* centro vertical do ponto: z é o centro, ou a base quando zb (caixa do dreno) */
const zc = it => it.zb ? it.z + it.h / 2 : it.z;
function itemBox(it) {
  if (it.kind === 'op') return { x0: it.u, x1: it.u + it.w, z0: it.z, z1: it.z + it.h };
  if (it.zb) return { x0: it.u - it.w / 2, x1: it.u + it.w / 2, z0: it.z, z1: it.z + it.h };
  return { x0: it.u - it.w / 2, x1: it.u + it.w / 2, z0: it.z - it.h / 2, z1: it.z + it.h / 2 };
}

/* ---------- Ambiente ---------- */
const hasWalls = r => !!(r.pts && r.pts.length >= 3);
const wnum = (r, i) => (r.wn && r.wn[i]) || i + 1;
const wallOrder = r => r.pts.map((_, i) => i).sort((a, b) => wnum(r, a) - wnum(r, b));
function newRoom(name, W, Lg, H) {
  return {
    id: uid('r'), name: name || 'Ambiente', H: H || 2700, Hsrc: 'manual',
    pts: W ? [[W, 0], [0, 0], [0, Lg], [W, Lg]] : [], wsrc: W ? [null, null, null, null] : [],
    items: [], ceil: [], photos: [], drains: [], obs: '', tw: 120, wt: [],
  };
}
function itemsOn(room, wall) {
  return room.items.filter(i => i.wall === wall).sort((a, b) => a.u - b.u);
}
/* Etiquetas (P1, J1...) e numeração dos pontos, estáveis por parede e posição */
function labelsFor(room) {
  const tags = {}, nums = {}, cnt = {};
  let pn = 0;
  const order = room.items.slice().sort((a, b) => (a.wall - b.wall) || (a.u - b.u));
  for (const it of order) {
    if (it.kind === 'op') {
      const p = LIBMAP[it.type].tag;
      cnt[p] = (cnt[p] || 0) + 1;
      tags[it.id] = p + cnt[p];
    }
  }
  const byWall = {};
  for (const it of order) {
    byWall[it.wall] = (byWall[it.wall] || 0) + 1;
    nums[it.id] = byWall[it.wall];
  }
  return { tags, nums };
}

const wallT = (room, i) => (room.wt && room.wt[i]) || room.tw || 120;
function wallSrc(room, i) { return room.wsrc[i] || 'manual'; }

/* Alterar o comprimento da parede i: a parede seguinte desliza, o ambiente continua fechado e ortogonal.
   Esquadrias e pontos das paredes afetadas acompanham de forma proporcional. */
function setWallLen(room, i, newLen, src) {
  const n = room.pts.length;
  newLen = Math.round(newLen * 10) / 10;
  if (!(newLen >= 50)) return { ok: false, msg: 'A parede precisa ter pelo menos 50 mm.' };
  const before = room.pts.map((_, k) => wallLen(room, k));
  const g = wallGeom(room, i);
  const delta = newLen - g.L;
  if (Math.abs(delta) < 0.05) return { ok: true };
  const j = (i + 1) % n, k = (i + 2) % n;
  const old = room.pts.map(p => p.slice());
  room.pts[j] = vadd(room.pts[j], vmul(g.d, delta));
  room.pts[k] = vadd(room.pts[k], vmul(g.d, delta));
  const after = room.pts.map((_, w) => wallLen(room, w));
  if (after.some(l => l < 50)) { room.pts = old; return { ok: false, msg: 'Essa medida faria outra parede ficar menor que 50 mm.' }; }
  room.wsrc[i] = src || 'manual';
  for (let w = 0; w < n; w++) {
    if (Math.abs(after[w] - before[w]) > 0.05) {
      const f = after[w] / before[w];
      for (const it of room.items) if (it.wall === w) {
        it.u = Math.round(it.u * f * 10) / 10;
        if (it.kind === 'op') it.u = clamp(it.u, 0, Math.max(0, after[w] - it.w));
        else it.u = clamp(it.u, 0, after[w]);
      }
    }
  }
  return { ok: true };
}

/* Recuo (depth < 0) ou pilar (depth > 0) na parede i, entre u0 e u0 + width */
function addNotch(room, i, u0, width, depth) {
  const g = wallGeom(room, i);
  if (!(u0 >= 50 && width >= 50 && g.L - (u0 + width) >= 50 && Math.abs(depth) >= 20)) {
    return { ok: false, msg: 'Posição e largura precisam caber na parede, deixando 50 mm de cada lado.' };
  }
  const wn0 = room.wn ? room.wn.slice() : room.pts.map((_, k) => k + 1), mx0 = Math.max(...wn0);
  const P = (a, b) => vadd(vadd(g.A, vmul(g.d, a)), vmul(g.nin, b));
  const np = [P(u0, 0), P(u0, depth), P(u0 + width, depth), P(u0 + width, 0)];
  room.pts.splice(i + 1, 0, ...np);
  wn0.splice(i + 1, 0, mx0 + 1, mx0 + 2, mx0 + 3, mx0 + 4); room.wn = wn0;
  room.wsrc.splice(i + 1, 0, null, null, null, null);
  if (room.wt) room.wt.splice(i + 1, 0, 0, 0, 0, 0);
  for (const it of room.items) {
    if (it.wall > i) it.wall += 4;
    else if (it.wall === i) {
      const c = it.kind === 'op' ? it.u + it.w / 2 : it.u;
      if (c > u0 + width) { it.wall = i + 4; it.u = Math.max(0, it.u - (u0 + width)); }
      else it.u = Math.min(it.u, Math.max(0, u0 - (it.kind === 'op' ? it.w : 0)));
    }
  }
  return { ok: true };
}

/* distâncias do ralo até as paredes (ambientes ortogonais): esquerda, direita, inferior, superior */
function drainRays(room, p) {
  const pts = room.pts, n = pts.length;
  let xl = -Infinity, xr = Infinity, yb = -Infinity, yt = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (Math.abs(a[0] - b[0]) < 0.5) {
      const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
      if (p[1] >= lo - 0.01 && p[1] <= hi + 0.01) { if (a[0] <= p[0] + 0.01) xl = Math.max(xl, a[0]); if (a[0] >= p[0] - 0.01) xr = Math.min(xr, a[0]); }
    } else if (Math.abs(a[1] - b[1]) < 0.5) {
      const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
      if (p[0] >= lo - 0.01 && p[0] <= hi + 0.01) { if (a[1] <= p[1] + 0.01) yb = Math.max(yb, a[1]); if (a[1] >= p[1] - 0.01) yt = Math.min(yt, a[1]); }
    }
  }
  return { xl, xr, yb, yt };
}
function newDrain(room) {
  const b = bbox(room.pts);
  let c = [rnd((b.x0 + b.x1) / 2, 10), rnd((b.y0 + b.y1) / 2, 10)];
  if (!pointInPoly(c, room.pts)) c = centroid(room.pts);
  return { id: uid('d'), x: c[0], y: c[1], d: 100, src: 'manual' };
}
function roomSummary(room) {
  if (!hasWalls(room)) return { area: 0, per: 0, gross: 0, net: 0, vol: 0, n: 0 };
  const area = Math.abs(area2(room.pts));
  let per = 0;
  for (let i = 0; i < room.pts.length; i++) per += wallLen(room, i);
  const gross = per * room.H;
  let op = 0;
  for (const it of room.items) if (it.kind === 'op') op += it.w * it.h;
  return { area, per, gross, net: gross - op, vol: area * room.H, n: room.pts.length };
}

/* ---------- Forro (gesso) ---------- */
/* afastamento por aresta (d[i] > 0 recua a aresta i → i+1 para dentro); serve a qualquer orientação */
function offsetPolyVar(pts, d) {
  const n = pts.length, sg = area2(pts) > 0 ? -1 : 1, out = [];
  const ed = i => { const a = pts[i], b = pts[(i + 1) % n], u = vnorm(vsub(b, a)); return { a: vadd(a, vmul([u[1] * sg, -u[0] * sg], d[i] || 0)), u }; };
  for (let j = 0; j < n; j++) {
    const e0 = ed((j - 1 + n) % n), e1 = ed(j);
    out.push(lineInter(e0.a, e0.u, e1.a, e1.u) || e1.a);
  }
  return out;
}
function ceilBase(room, el) {
  if (el.kind === 'room') return room.pts;
  if (el.kind === 'poly') return el.pts;
  return [[el.x, el.y], [el.x + el.w, el.y], [el.x + el.w, el.y + el.h], [el.x, el.y + el.h]];
}
function ceilPoly(room, el) {
  const base = ceilBase(room, el);
  if (!el.eo || !el.eo.some(v => v)) return base;
  const res = offsetPolyVar(base, base.map((_, i) => el.eo[i] || 0));
  if (Math.sign(area2(res)) !== Math.sign(area2(base)) || !polySimple(res)) return base;
  return res;
}
const negH = (room, el) => el.nh || (room.H + 100);
function wallTopExtra(room) {
  let m = 0;
  for (const e of room.ceil) if (e.trim === 'neg') m = Math.max(m, negH(room, e) - room.H);
  return m;
}
function newCeil(kind, room, extra) {
  const b = bbox(room.pts);
  const el = { id: uid('f'), kind, name: kind === 'room' ? 'Forro do ambiente' : 'Forro rebaixado', drop: kind === 'room' ? 0 : 100, trim: 'none', tw: 30, th: 40, nh: room.H + 100 };
  if (kind === 'rect') Object.assign(el, { x: b.x0 + 300, y: b.y0 + 300, w: Math.min(1500, b.w - 600), h: Math.min(1000, b.h - 600) });
  return Object.assign(el, extra || {});
}
/* O que o forro faz na parede i, para a vista frontal */
function ceilOnWall(room, wall) {
  const g = wallGeom(room, wall);
  const out = [];
  const TOL = 5;
  for (const el of room.ceil) {
    const poly = ceilPoly(room, el);
    if (el.kind === 'room' && !(el.eo && el.eo.some(v => v))) { out.push({ el, u0: 0, u1: g.L, touching: true, dist: 0 }); continue; }
    let touch = null;
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e], b = poly[(e + 1) % poly.length];
      const da = vdot(vsub(a, g.A), g.nin), db = vdot(vsub(b, g.A), g.nin);
      if (Math.abs(da) <= TOL && Math.abs(db) <= TOL) {
        const ua = vdot(vsub(a, g.A), g.d), ub = vdot(vsub(b, g.A), g.d);
        const u0 = clamp(Math.min(ua, ub), 0, g.L), u1 = clamp(Math.max(ua, ub), 0, g.L);
        if (u1 - u0 > 1) touch = touch ? { u0: Math.min(touch.u0, u0), u1: Math.max(touch.u1, u1) } : { u0, u1 };
      }
    }
    if (touch) { out.push({ el, u0: touch.u0, u1: touch.u1, touching: true, dist: 0 }); continue; }
    const ds = poly.map(p => vdot(vsub(p, g.A), g.nin));
    const us = poly.map(p => vdot(vsub(p, g.A), g.d));
    const dmin = Math.min(...ds);
    if (dmin < -TOL) continue;
    const u0 = clamp(Math.min(...us), 0, g.L), u1 = clamp(Math.max(...us), 0, g.L);
    if (u1 - u0 > 1) out.push({ el, u0, u1, touching: false, dist: dmin });
  }
  return out;
}

/* ---------- Contorno à mão livre → paredes ortogonais ---------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts[pts.length - 1];
  let md = -1, mi = -1;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = L < 1e-6 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > md) { md = d; mi = i; }
  }
  if (md <= eps) return [a, b];
  return rdp(pts.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(pts.slice(mi), eps));
}
function segInter(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function polySimple(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (segInter(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
  }
  return true;
}
/* tr: pontos do traço em mm, na ordem do desenho. Devolve {ok, pts, wn} ou {ok:false,msg} */
function traceToPoly(tr) {
  const fail = msg => ({ ok: false, msg });
  if (tr.length < 6) return fail('Traço curto demais. Contorne o ambiente de canto em canto.');
  const b = bbox(tr), D = Math.max(b.w, b.h);
  if (D < 600) return fail('Desenho pequeno demais. Faça o contorno maior.');
  let s = rdp(tr.concat([tr[0]]), Math.max(0.045 * D, 150));
  s.pop();
  const segs = [];
  for (let k = 0; k < s.length; k++) {
    const a = s[k], c = s[(k + 1) % s.length];
    const dx = c[0] - a[0], dy = c[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const h = Math.abs(dx) >= Math.abs(dy);
    segs.push({ h, c: h ? (a[1] + c[1]) / 2 : (a[0] + c[0]) / 2, w: len });
  }
  const m = [];
  for (const g of segs) {
    const l = m[m.length - 1];
    if (l && l.h === g.h) { l.c = (l.c * l.w + g.c * g.w) / (l.w + g.w); l.w += g.w; } else m.push(Object.assign({}, g));
  }
  while (m.length > 1 && m[0].h === m[m.length - 1].h) { const l = m.pop(), f = m[0]; f.c = (f.c * f.w + l.c * l.w) / (f.w + l.w); f.w += l.w; }
  if (m.length < 4 || m.length % 2) return fail('Não consegui achar os cantos. Desenhe o contorno fechado, com cantos retos.');
  const n = m.length, pts = [];
  for (let k = 0; k < n; k++) {
    const sg = m[k], pr = m[(k + n - 1) % n];
    pts.push(sg.h ? [rnd(pr.c, 10), rnd(sg.c, 10)] : [rnd(sg.c, 10), rnd(pr.c, 10)]);
  }
  for (let k = 0; k < n; k++) if (Math.hypot(pts[k][0] - pts[(k + 1) % n][0], pts[k][1] - pts[(k + 1) % n][1]) < 150) return fail('Há um trecho de parede muito curto. Refaça o desenho com cantos mais claros.');
  if (!polySimple(pts)) return fail('O contorno se cruza. Refaça sem cruzar as linhas.');
  if (area2(pts) > 0) {
    const q = pts.slice().reverse();
    const wn = q.map((_, j) => (((n - 2 - j) % n) + n) % n + 1);
    return { ok: true, pts: q, wn };
  }
  return { ok: true, pts, wn: pts.map((_, j) => j + 1) };
}
/* arrasta o canto k: os vizinhos acompanham para manter os ângulos retos */
function moveCorner(room, k, t) {
  const P = room.pts, n = P.length, pr = (k + n - 1) % n, nx = (k + 1) % n;
  const oldPts = P.map(p => p.slice()), before = P.map((_, i) => wallLen(room, i)), sign = Math.sign(area2(P));
  const isH = (a, b) => Math.abs(a[1] - b[1]) < 0.5, isV = (a, b) => Math.abs(a[0] - b[0]) < 0.5;
  if (isH(P[pr], P[k])) P[pr][1] = t[1]; else if (isV(P[pr], P[k])) P[pr][0] = t[0];
  if (isH(P[nx], P[k])) P[nx][1] = t[1]; else if (isV(P[nx], P[k])) P[nx][0] = t[0];
  P[k] = [t[0], t[1]];
  const after = P.map((_, i) => wallLen(room, i));
  if (after.some(l => l < 50) || Math.sign(area2(P)) !== sign || !polySimple(P)) { room.pts = oldPts; return false; }
  for (let w = 0; w < n; w++) if (Math.abs(after[w] - before[w]) > 0.05) {
    room.wsrc[w] = null;
    const f = after[w] / before[w];
    for (const it of room.items) if (it.wall === w) {
      it.u = Math.round(it.u * f * 10) / 10;
      it.u = it.kind === 'op' ? clamp(it.u, 0, Math.max(0, after[w] - it.w)) : clamp(it.u, 0, after[w]);
    }
  }
  return true;
}

/* ---------- Clientes e estado ---------- */
const today = () => new Date().toISOString().slice(0, 10);
function newClient(o) {
  return Object.assign({ id: uid('c'), nome: '', endereco: '', loja: '', consultor: '', arquiteto: '', obs: '', criado: today(), rooms: [] }, o || {});
}
function newState() { return { v: 2, unit: 'mm', clients: [], cc: null, cur: 0, wall: 0 }; }

function sampleKitchen() {
  const r = newRoom('Cozinha', 6100, 3050, 2634);
  r.pts = [[6100, 0], [0, 0], [0, 3050], [2400, 3050], [2400, 2820], [6100, 2820]];
  r.wsrc = [null, null, null, null, null, null];
  const add = (type, wall, u, z, ex) => {
    const it = makeItem(type, wall, r);
    it.u = u; if (z != null) it.z = z;
    Object.assign(it, ex || {});
    r.items.push(it); return it;
  };
  add('porta-giro', 0, 770, 0, { w: 900, h: 2110, hinge: 'L', swing: 'in' });
  add('porta-giro', 0, 2850, 0, { w: 900, h: 2110, hinge: 'R', swing: 'in' });
  add('janela', 1, 795, 780, { w: 1000, h: 1000 });
  add('coringa', 2, 907, 1235, { name: 'Objeto de parede', w: 500, h: 500 });
  add('tomada', 4, 600, 1200);
  add('tomada', 4, 1450, 1200);
  add('af', 4, 2050, 600);
  add('esg', 4, 2250, 500);
  add('tomada2', 4, 2950, 1200);
  add('dreno', 5, 1410, 2000);
  r.drains.push({ id: uid('d'), x: 3200, y: 1300, d: 100, src: 'manual' });
  r.ceil.push(Object.assign(newCeil('room', r), { drop: 0, trim: 'roda', tw: 40, th: 50 }));
  r.ceil.push(Object.assign(newCeil('rect', r), { name: 'Sanca da bancada', x: 500, y: 500, w: 3000, h: 1800, drop: 100, trim: 'neg', tw: 20, th: 30 }));
  r.obs = 'Parede 5 com tubulação aparente do lado esquerdo. Conferir nível do piso na porta 2.';
  return r;
}
function sampleState() {
  const st = newState();
  st.clients.push(newClient({ nome: 'João da Silva', endereco: 'Rua das Acácias, 120 - ap. 52', loja: 'Todeschini Exemplo', consultor: 'Maria Souza', arquiteto: 'Ana Lima', obs: 'Cliente quer instalação após 15/12.', rooms: [sampleKitchen(), newRoom('Sala', 4200, 3600, 2634)] }));
  return st;
}

/* migração de projetos antigos (v1: ambientes soltos) e normalização */
function normRoom(r) {
  r.drains = r.drains || []; r.obs = r.obs || ''; r.tw = r.tw || 120; r.wt = r.wt || []; r.photos = r.photos || []; r.ceil = r.ceil || [];
  for (const it of r.items) {
    if (it.type === 'dreno' && !it.zb) { it.zb = true; it.w = 280; it.h = 150; it.z = Math.max(0, it.z - 75); }
  }
  return r;
}
function migrateState(o) {
  if (!o) return null;
  if (o.v === 1 && Array.isArray(o.rooms)) {
    const m = o.meta || {};
    const c = newClient({ nome: m.cliente || m.projeto || 'Cliente', endereco: m.local || '', consultor: m.resp || '', criado: m.data || today(), rooms: o.rooms });
    o = { v: 2, unit: o.unit || 'mm', clients: [c], cc: null, cur: 0, wall: 0 };
  }
  if (o.v !== 2 || !Array.isArray(o.clients)) return null;
  for (const c of o.clients) { c.rooms = c.rooms || []; c.rooms.forEach(normRoom); }
  return o;
}
/* cliente -> objeto usado pelos exportadores */
function projOf(c, unit, rooms) {
  return { unit, rooms: rooms || c.rooms, meta: { nome: c.nome, endereco: c.endereco, loja: c.loja, consultor: c.consultor, arquiteto: c.arquiteto, obs: c.obs, data: c.criado } };
}
