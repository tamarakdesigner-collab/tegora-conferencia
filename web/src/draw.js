/* ===== Tégora · desenhos técnicos (planta, parede, forro, fotos) ===== */
'use strict';

const PAL_PRINT = {
  paper: '#FFFFFF', floor: '#FFFFFF', wall: '#2A2826', ink: '#2A2826', dim: '#6B4423', mut: '#6A645B', faint: '#CBC4B8',
  accent: '#9C7A48', sel: '#9C7A48', ele: '#6B4423', hid: '#2B6A8C', ar: '#3F7A55', cor: '#5A564F',
  gesso: '#EFEBE4', gessoLn: '#9C8F7C', neg: '#2A2826', roda: '#CBC4B8', door: '#F6F3EE', glass: '#DCE6EA', ok: '#2A2826', surf: '#F4F1EC',
};
const PAL_SCREEN = {};
Object.keys(PAL_PRINT).forEach(k => { PAL_SCREEN[k] = 'var(--p-' + k + ')'; });

class View {
  constructor(s, ox, oy) { this.s = s; this.ox = ox; this.oy = oy; }
  X(x) { return this.ox + this.s * x; }
  Y(y) { return this.oy - this.s * y; }
  inv(px, py) { return [(px - this.ox) / this.s, (this.oy - py) / this.s]; }
  static fit(b, r, pad) {
    const bw = Math.max(b.x1 - b.x0, 1), bh = Math.max(b.y1 - b.y0, 1);
    const s = Math.min((r.w - 2 * pad) / bw, (r.h - 2 * pad) / bh);
    return new View(s, r.x + r.w / 2 - s * (b.x0 + b.x1) / 2, r.y + r.h / 2 + s * (b.y0 + b.y1) / 2);
  }
}
const mkCtx = (G, v, o) => Object.assign({ G, v, K: 1, P: PAL_SCREEN, hit: true }, o || {});
const dev = (c, p) => [c.v.X(p[0]), c.v.Y(p[1])];
const polyDev = (c, pts) => pts.map(p => dev(c, p));
const LY = (c, n) => { if (c.G.layer) c.G.layer(n); };
const CATLAYER = { ele: 'TG_ELETRICA', hid: 'TG_HIDRAULICA', ar: 'TG_AR', cor: 'TG_CORINGA' };
const lum = h => { const [r, g, b] = hexRGB(h); return 0.299 * r + 0.587 * g + 0.114 * b; };

/* ---------- marcas e cotas ---------- */
function checkMark(c, x, y, s, col, ang) {
  const th = (ang || 0) * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
  const pts = [[-0.45, 0.05], [-0.1, 0.42], [0.5, -0.45]].map(p => {
    const px = p[0] * s, py = p[1] * s;
    return [x + px * ct - py * st, y + px * st + py * ct];
  });
  c.G.poly(pts, { close: false, stroke: col, w: 1.3 * c.K });
}
/* p1, p2 em coordenadas do mundo; nw = direção (mundo) para onde a linha de cota é deslocada; off em px */
function dimLine(c, p1, p2, nw, off, text, o) {
  o = o || {};
  const { G, v, K, P } = c;
  const prevL = G.cur; LY(c, 'TG_COTAS');
  const x1 = v.X(p1[0]), y1 = v.Y(p1[1]), x2 = v.X(p2[0]), y2 = v.Y(p2[1]);
  let nx = nw[0], ny = -nw[1]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const ox = nx * off * K, oy = ny * off * K;
  const a = [x1 + ox, y1 + oy], b = [x2 + ox, y2 + oy];
  const col = o.color || P.dim;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ex = 3.5 * K;
  G.line(x1 + nx * 2 * K, y1 + ny * 2 * K, a[0] + nx * ex, a[1] + ny * ex, { stroke: col, w: 0.6 * K });
  G.line(x2 + nx * 2 * K, y2 + ny * 2 * K, b[0] + nx * ex, b[1] + ny * ex, { stroke: col, w: 0.6 * K });
  G.line(a[0], a[1], b[0], b[1], { stroke: col, w: 0.9 * K });
  const tx = len > 0.01 ? (b[0] - a[0]) / len : 1, ty = len > 0.01 ? (b[1] - a[1]) / len : 0;
  const tk = 3.2 * K, kx = tx - nx, ky = ty - ny, kl = Math.hypot(kx, ky) || 1;
  for (const q of [a, b]) G.line(q[0] - kx / kl * tk, q[1] - ky / kl * tk, q[0] + kx / kl * tk, q[1] + ky / kl * tk, { stroke: col, w: 1.1 * K });
  if (text == null || text === '') { LY(c, prevL); return; }
  let ang = Math.atan2(ty, tx) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const fs = (o.size || 8.5) * K;
  const tp = o.tpos == null ? 0.5 : o.tpos;
  const to = (o.toff || 0) * K;
  const mx = a[0] + (b[0] - a[0]) * tp + nx * (fs * 0.72 + 1.5 * K + to), my = a[1] + (b[1] - a[1]) * tp + ny * (fs * 0.72 + 1.5 * K + to);
  G.text(mx, my, text, { size: fs, rot: ang, fill: o.tcolor || P.ink, font: 'mono', bold: o.bold });
  if (o.src === 'laser') {
    const w = textW(text, fs, { font: 'mono' });
    const dx = Math.cos(ang * Math.PI / 180), dy = Math.sin(ang * Math.PI / 180);
    checkMark(c, mx - dx * (w / 2 + 4.5 * K), my - dy * (w / 2 + 4.5 * K), 6 * K, col, ang);
  }
  LY(c, prevL);
}
function badge(c, x, y, s, o) {
  o = o || {};
  const { G, K, P } = c, r = (o.r || 6.2) * K;
  LY(c, 'TG_ROTULOS');
  G.circle(x, y, r, { fill: o.fill || P.paper, stroke: o.stroke || P.ink, w: 0.9 * K });
  G.text(x, y, s, { size: (o.size || 7.6) * K, bold: true, fill: o.tcolor || P.ink, font: 'sans' });
}

/* ---------- planta ---------- */
function chainSegs(room, wi) {
  const g = wallGeom(room, wi);
  const ops = itemsOn(room, wi).filter(i => i.kind === 'op');
  const segs = []; let cur = 0;
  for (const it of ops) {
    const a = clamp(it.u, 0, g.L), b = clamp(it.u + it.w, 0, g.L);
    if (a - cur >= 1) segs.push({ a: cur, b: a, src: null });
    if (b - a >= 1) segs.push({ a, b, src: it.src, op: true });
    cur = Math.max(cur, b);
  }
  if (g.L - cur >= 1) segs.push({ a: cur, b: g.L, src: null });
  return { segs, ops };
}

function drawWallsBase(c, room, o) {
  const { G, v, K, P } = c;
  const twArr = room.pts.map((_, i) => wdel(room, i) ? 0 : Math.max(5 * K / v.s, wallT(room, i)));
  const tw = Math.max(...twArr), twPx = tw * v.s;
  LY(c, 'TG_PAREDES');
  G.poly(polyDev(c, offsetPolyVar(room.pts, twArr.map(x => -x))), { fill: P.wall });
  G.poly(polyDev(c, room.pts), { fill: P.floor });
  room.pts.forEach((p, i) => { if (wdel(room, i)) { const q = room.pts[(i + 1) % room.pts.length]; G.line(...dev(c, p), ...dev(c, q), { stroke: P.mut, w: 0.8 * K, dash: [5 * K, 4 * K] }); } });
  return { tw, twPx, twArr };
}

function planOpening(c, it, g, tw, tag) {
  const { G, v, K, P } = c;
  LY(c, 'TG_ESQUADRIAS');
  const Wp = (u, b) => dev(c, [g.A[0] + g.d[0] * u + g.nin[0] * b, g.A[1] + g.d[1] * u + g.nin[1] * b]);
  const u0 = it.u, u1 = it.u + it.w, eps = 0.8 * K / v.s;
  G.poly([Wp(u0, eps), Wp(u1, eps), Wp(u1, -tw - eps), Wp(u0, -tw - eps)], { fill: P.floor });
  const ink = { stroke: P.ink, w: 1.1 * K }, thin = { stroke: P.ink, w: 0.7 * K };
  const jamb = (u) => G.line(...Wp(u, 0), ...Wp(u, -tw), ink);
  const t = it.type;
  const leaf = (hu, dirSign, wd, swIn) => {
    const hb = swIn ? 0 : -tw;
    const H = [g.A[0] + g.d[0] * hu + g.nin[0] * hb, g.A[1] + g.d[1] * hu + g.nin[1] * hb];
    const nd = swIn ? g.nin : [-g.nin[0], -g.nin[1]];
    const dd = [g.d[0] * dirSign, g.d[1] * dirSign];
    const E = [H[0] + nd[0] * wd, H[1] + nd[1] * wd];
    G.line(...dev(c, H), ...dev(c, E), { stroke: P.ink, w: 1.4 * K });
    const a0 = Math.atan2(nd[1], nd[0]); let a1 = Math.atan2(dd[1], dd[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (G.arc) { const cd = dev(c, H); G.arc(cd[0], cd[1], wd * v.s, Math.min(a0, a0 + da) * 180 / Math.PI, Math.max(a0, a0 + da) * 180 / Math.PI); }
    else {
      const pts = [];
      for (let k = 0; k <= 14; k++) { const a = a0 + da * k / 14; pts.push(dev(c, [H[0] + Math.cos(a) * wd, H[1] + Math.sin(a) * wd])); }
      G.poly(pts, { close: false, stroke: P.mut, w: 0.7 * K });
    }
  };
  if (t === 'porta-giro') {
    jamb(u0); jamb(u1);
    const L = (it.hinge || 'L') === 'L';
    leaf(L ? u0 : u1, L ? 1 : -1, it.w, (it.swing || 'in') === 'in');
  } else if (t === 'porta-giro2') {
    jamb(u0); jamb(u1);
    const sw = (it.swing || 'in') === 'in';
    leaf(u0, 1, it.w / 2, sw); leaf(u1, -1, it.w / 2, sw);
  } else if (t === 'porta-correr' || t === 'porta-janela' || t === 'janela-correr') {
    jamb(u0); jamb(u1);
    const m = (u1 - u0);
    G.line(...Wp(u0, -tw * 0.3), ...Wp(u0 + m * 0.56, -tw * 0.3), ink);
    G.line(...Wp(u0 + m * 0.44, -tw * 0.7), ...Wp(u1, -tw * 0.7), ink);
    if (t !== 'porta-correr') { G.line(...Wp(u0, 0), ...Wp(u1, 0), thin); G.line(...Wp(u0, -tw), ...Wp(u1, -tw), thin); }
  } else if (t === 'janela') {
    jamb(u0); jamb(u1);
    G.line(...Wp(u0, 0), ...Wp(u1, 0), thin); G.line(...Wp(u0, -tw / 2), ...Wp(u1, -tw / 2), ink); G.line(...Wp(u0, -tw), ...Wp(u1, -tw), thin);
  } else {
    G.line(...Wp(u0, 0), ...Wp(u0, -tw), { stroke: P.ink, w: 0.9 * K, dash: [3 * K, 2 * K] });
    G.line(...Wp(u1, 0), ...Wp(u1, -tw), { stroke: P.ink, w: 0.9 * K, dash: [3 * K, 2 * K] });
  }
  if (tag) {
    const mid = (u0 + u1) / 2, off = 12 * K / v.s;
    const q = dev(c, [g.A[0] + g.d[0] * mid + g.nin[0] * off, g.A[1] + g.d[1] * mid + g.nin[1] * off]);
    G.text(q[0], q[1], tag, { size: 8 * K, bold: true, fill: P.ink });
  }
}

function drawDrains(c, room, o) {
  const { G, v, K, P } = c;
  LY(c, 'TG_HIDRAULICA');
  (room.drains || []).forEach((d, k) => {
    const [x, y] = dev(c, [d.x, d.y]);
    const r = Math.max(d.d / 2 * v.s, 6.5 * K), sel = o.selDrain === d.id;
    G.circle(x, y, r, { fill: P.paper, stroke: sel ? P.sel : P.hid, w: (sel ? 2.4 : 1.5) * K });
    const q = r * 0.7;
    G.line(x - q, y - q, x + q, y + q, { stroke: P.hid, w: 1 * K });
    G.line(x - q, y + q, x + q, y - q, { stroke: P.hid, w: 1 * K });
    G.text(x + r + 3 * K, y - r - 2 * K, 'RL' + (k + 1), { size: 7.6 * K, bold: true, anchor: 'start', fill: P.hid });
    if (c.hit) G.hitRect(x - r - 6, y - r - 6, 2 * r + 12, 2 * r + 12, 'r:' + d.id);
    if (!o.mini) {
      const ry = drainRays(room, [d.x, d.y]);
      const hx = (d.x - ry.xl <= ry.xr - d.x) ? ry.xl : ry.xr, vy = (d.y - ry.yb <= ry.yt - d.y) ? ry.yb : ry.yt;
      const ac = { color: P.hid, tcolor: P.hid, size: 7.6, src: d.src };
      if (isFinite(hx)) dimLine(c, [d.x, d.y], [hx, d.y], [0, 1], 0, fmt(Math.abs(d.x - hx)), ac);
      if (isFinite(vy)) dimLine(c, [d.x, d.y], [d.x, vy], [1, 0], 0, fmt(Math.abs(d.y - vy)), ac);
    }
  });
}
function drawPlan(c, room, o) {
  o = o || {};
  const { G, v, K, P } = c;
  const { tw, twPx, twArr } = drawWallsBase(c, room);
  const n = room.pts.length;
  const lab = labelsFor(room);
  for (const it of room.items) if (it.kind === 'op') planOpening(c, it, wallGeom(room, it.wall), twArr[it.wall], o.mini ? null : lab.tags[it.id]);
  for (const it of room.items) if (it.type === 'bacia' && !wdel(room, it.wall)) {
    const g = wallGeom(room, it.wall), D = it.d || 700, W = it.w, col = P.hid;
    const Q = (u, b) => dev(c, [g.A[0] + g.d[0] * (it.u + u) + g.nin[0] * b, g.A[1] + g.d[1] * (it.u + u) + g.nin[1] * b]);
    LY(c, 'TG_HIDRAULICA');
    const tD = Math.min(D * 0.3, 220);
    G.poly([Q(-W / 2, 0), Q(W / 2, 0), Q(W / 2, tD), Q(-W / 2, tD)], { fill: P.paper, stroke: col, w: 1.3 * K });
    const bw = W * 0.78, cxp = [], ry = (D - tD) / 2;
    for (let k = 0; k <= 28; k++) { const a = Math.PI * 2 * k / 28; cxp.push(Q(Math.cos(a) * bw / 2, tD + ry + Math.sin(a) * ry)); }
    G.poly(cxp, { fill: P.paper, stroke: col, w: 1.3 * K });
  }
  drawDrains(c, room, o);
  if (o.corners && c.hit && !o.mini) {
    LY(c, 'TG_ROTULOS');
    room.pts.forEach((p, k) => {
      const [x, y] = dev(c, p), sel = o.selCorner === k;
      G.circle(x, y, (sel ? 8 : 6) * K, { fill: sel ? P.sel : P.paper, stroke: sel ? P.sel : P.ink, w: 1.6 * K });
      G.circle(x, y, 17, { fill: 'rgba(0,0,0,0.001)', stroke: 'none', pe: 'all', id: 'c:' + k });
    });
  }
  if (o.selWall != null && o.selWall < n) {
    const g = wallGeom(room, o.selWall);
    G.line(...dev(c, g.A), ...dev(c, g.B), { stroke: P.sel, w: 3 * K });
  }
  const dimGroups = [];
  for (let i = 0; i < n; i++) {
    if (wdel(room, i)) continue;
    const g = wallGeom(room, i);
    if (c.hit) G.hitLine(...dev(c, g.A), ...dev(c, g.B), 'w:' + i, 18);
    if (o.mini) continue;
    const mid = [g.A[0] + g.d[0] * g.L / 2 + g.nin[0] * 15 * K / v.s, g.A[1] + g.d[1] * g.L / 2 + g.nin[1] * 15 * K / v.s];
    const m = dev(c, mid);
    badge(c, m[0], m[1], String(wnum(room, i)), { fill: i === o.selWall ? P.sel : P.paper, stroke: i === o.selWall ? P.sel : P.ink, tcolor: i === o.selWall ? '#FFFFFF' : P.ink });
    const out = [-g.nin[0], -g.nin[1]];
    const ch = chainSegs(room, i);
    if (ch.ops.length) dimGroups.push({ wall: i, g, out, lvl: 0, items: ch.segs.map(q => ({ p1: vadd(g.A, vmul(g.d, q.a)), p2: vadd(g.A, vmul(g.d, q.b)), text: fmt(q.b - q.a), o: { src: q.src } })) });
    dimGroups.push({ wall: i, g, out, lvl: 1, items: [{ p1: g.A, p2: g.B, text: fmt(g.L), o: { src: room.wsrc[i], bold: true } }] });
  }
  if (!o.mini) placeDims(c, room, dimGroups, twPx / K + 12, twArr);
  if (!o.mini) {
    const ct = centroid(room.pts), q = dev(c, ct);
    const s = roomSummary(room);
    LY(c, 'TG_TEXTO');
    G.text(q[0], q[1] - 8 * K, room.name, { size: 15 * K, font: 'serif', bold: true, fill: P.ink });
    G.text(q[0], q[1] + 7 * K, (s.area / 1e6).toFixed(2).replace('.', ',') + ' m²', { size: 9 * K, font: 'mono', fill: P.mut });
    G.text(q[0], q[1] + 19 * K, 'pé-direito ' + fmt(room.H), { size: 8 * K, font: 'mono', fill: P.mut });
    if (room.Hsrc === 'laser') checkMark(c, q[0] - textW('pé-direito ' + fmt(room.H), 8 * K, { font: 'mono' }) / 2 - 5 * K, q[1] + 19 * K, 6 * K, P.dim);
  }
}


/* Distribuição automática das cotas da planta: cada fileira procura o primeiro afastamento livre,
   sem encostar em outras cotas, textos ou paredes; textos que não cabem no vão sobem em degraus. */
function placeDims(c, room, groups, base, twArr) {
  const { v, K, P } = c, fs = 8.5 * K, tH = fs * 1.5 + 2 * K;
  const placed = [], walls = [];
  room.pts.forEach((p, j) => {
    if (wdel(room, j)) return;
    const g = wallGeom(room, j), t = twArr[j] || 0;
    const pp = [g.A, g.B, vadd(g.B, vmul(g.nin, -t)), vadd(g.A, vmul(g.nin, -t))].map(q => dev(c, q));
    const xs = pp.map(q => q[0]), ys = pp.map(q => q[1]);
    walls.push([Math.min(...xs) - K, Math.max(...xs) + K, Math.min(...ys) - K, Math.max(...ys) + K, j]);
  });
  const hit = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  const boxOf = (grp, off, tl) => {
    const nx0 = grp.out[0], ny0 = -grp.out[1], nl = Math.hypot(nx0, ny0) || 1, nx = nx0 / nl, ny = ny0 / nl;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    grp.items.forEach((it, k) => {
      const a = dev(c, it.p1), b = dev(c, it.p2), tw = textW(it.text, fs, { font: 'mono' }) + 6 * K;
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], span = Math.hypot(b[0] - a[0], b[1] - a[1]), hw = Math.max(span, tw) / 2;
      const ux = span > 0.01 ? (b[0] - a[0]) / span : 1, uy = span > 0.01 ? (b[1] - a[1]) / span : 0;
      const d0 = off * K - 2 * K, d1 = off * K + tH + (tl[k] || 0) * K;
      for (const [ss, dd] of [[-hw, d0], [hw, d0], [-hw, d1], [hw, d1]]) { const px = m[0] + ux * ss + nx * dd, py = m[1] + uy * ss + ny * dd; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    });
    return [x0, x1, y0, y1];
  };
  const tlevels = grp => {
    /* degraus de texto para vãos estreitos vizinhos */
    const lv = [], occ = [];
    grp.items.forEach((it, k) => {
      const a = dev(c, it.p1), b = dev(c, it.p2), tw = textW(it.text, fs, { font: 'mono' }) + 6 * K, span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = (a[0] + b[0]) / 2 + (a[1] + b[1]) / 2;
      if (grp.items.length === 1 || span >= tw) { lv.push(0); return; }
      let l = 1;
      for (; l < 6; l++) { if (!(occ[l] || []).some(q => Math.abs(q - m) < tw * 0.95)) break; }
      (occ[l] = occ[l] || []).push(m); lv.push(l * 9);
    });
    return lv;
  };
  const order = groups.slice().sort((a, b) => a.lvl - b.lvl);
  const offOf = new Map();
  for (const grp of order) {
    const tl = tlevels(grp);
    let off = base;
    const inner = offOf.get(grp.wall);
    if (grp.lvl === 1 && inner != null) off = Math.max(off, inner + 15 + Math.max(0, ...tl) * 0.0);
    let ok = false;
    for (let guard = 0; guard < 60 && !ok; guard++) {
      const bx = boxOf(grp, off, tl);
      if (!placed.some(q => hit(bx, q)) && !walls.some(q => q[4] !== grp.wall && hit(bx, q))) { placed.push(bx); ok = true; } else off += 6;
    }
    if (!ok) placed.push(boxOf(grp, off, tl));
    if (grp.lvl === 0) offOf.set(grp.wall, off + Math.max(0, ...tl));
    grp.items.forEach((it, k) => dimLine(c, it.p1, it.p2, grp.out, off, it.text, Object.assign({ toff: tl[k] || 0 }, it.o)));
  }
}

/* ---------- forro em planta ---------- */
function hatchPoly(c, pts, step, col, ang) {
  const { G } = c;
  const bb = bbox(pts);
  G.clipPoly(pts);
  const a = (ang == null ? 45 : ang) * Math.PI / 180;
  const dx = Math.cos(a), dy = -Math.sin(a);
  const diag = Math.hypot(bb.w, bb.h) + 4;
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  for (let t = -diag; t <= diag; t += step) {
    const px = cx - dy * t, py = cy + dx * t;
    G.line(px - dx * diag, py - dy * diag, px + dx * diag, py + dy * diag, { stroke: col, w: 0.5 * c.K });
  }
  G.unclip();
}
function roomLabelPos(room) {
  const b = bbox(room.pts), rects = room.ceil.filter(e => e.kind === 'rect').map(e => bbox(ceilPoly(room, e)));
  let best = centroid(room.pts), bd = -1;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 8; j++) {
    const p = [b.x0 + b.w * i / 12, b.y0 + b.h * j / 8];
    if (!rectInsideRoom(p[0] - 500, p[1] - 150, 1000, 300, room.pts)) continue;
    let d = Infinity;
    for (const r of rects) {
      const dx = Math.max(r.x0 - 600 - p[0], 0, p[0] - r.x1 - 600), dy = Math.max(r.y0 - 200 - p[1], 0, p[1] - r.y1 - 200);
      d = Math.min(d, Math.hypot(dx, dy));
    }
    if (d > bd + 1e-6) { bd = d; best = p; }
  }
  return best;
}
function drawCeil(c, room, o) {
  o = o || {};
  const { G, v, K, P } = c;
  const { tw, twPx } = drawWallsBase(c, room);
  const n = room.pts.length;
  for (const el of room.ceil) {
    const poly = ceilPoly(room, el);
    const dp = polyDev(c, poly);
    const sel = o.selCeil === el.id;
    LY(c, 'TG_FORRO');
    G.poly(dp, { fill: el.kind === 'room' ? P.surf : P.gesso, stroke: sel ? P.sel : P.gessoLn, w: (sel ? 2.4 : 1.2) * K, dash: el.sanca ? [5 * K, 3 * K] : undefined });
    hatchPoly(c, dp, 6 * K, P.faint, el.kind === 'room' ? 45 : 135);
    if (el.sanca) hatchPoly(c, dp, 6 * K, P.faint, 45);
    if (el.trim !== 'none') {
      const t = Math.max(3.2 * K / v.s, el.tw);
      const inner = offsetPolyVar(poly, poly.map(() => t));
      if (el.trim === 'roda') { LY(c, 'TG_RODAFORRO'); G.poly(polyDev(c, inner), { stroke: P.cor, w: 1.6 * K }); }
      else { LY(c, 'TG_NEGATIVO'); G.poly(polyDev(c, inner), { stroke: P.ink, w: 1.1 * K, dash: [4 * K, 2.5 * K] }); }
    }
    if (c.hit && o.hitCeil) G.poly(dp, { fill: 'rgba(0,0,0,0.001)', stroke: 'none', pe: 'all', id: 'f:' + el.id });
    if (sel || (el.eo && el.eo.some(q => q))) {
      LY(c, 'TG_TEXTO');
      poly.forEach((p0, k) => {
        const p1 = poly[(k + 1) % poly.length], m = dev(c, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]);
        const ev = (el.eo && el.eo[k]) || 0;
        if (sel) { G.circle(m[0], m[1], 7 * K, { fill: P.paper, stroke: P.sel, w: 1.2 * K }); G.text(m[0], m[1], String(el.kind === 'room' ? wnum(room, k) : k + 1), { size: 7 * K, bold: true, fill: P.sel }); }
        if (ev) G.text(m[0], m[1] + (sel ? 14 : 0) * K, fmt(ev), { size: 7 * K, font: 'mono', bold: true, fill: P.cor });
      });
    }
  }
  for (let i = 0; i < n; i++) {
    const g = wallGeom(room, i);
    const out = [-g.nin[0], -g.nin[1]];
    dimLine(c, g.A, g.B, out, twPx / K + 12, fmt(g.L), { src: room.wsrc[i] });
  }
  for (const el of room.ceil) {
    const poly = ceilPoly(room, el);
    const bb = bbox(poly);
    const pos = el.kind === 'room' ? roomLabelPos(room) : [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
    const q = dev(c, pos);
    LY(c, 'TG_TEXTO');
    const dy = el.kind === 'room' ? 12 * K : 0;
    const l1 = el.name, l2 = el.sanca ? 'sanca · profundidade ' + fmt(el.drop) : el.drop > 0 ? 'rebaixo ' + fmt(el.drop) + ' · forro a ' + fmt(room.H - el.drop) : 'forro rente à laje';
    const l3 = el.trim === 'roda' ? 'rodaforro ' + fmt(el.tw) + ' × ' + fmt(el.th) : el.trim === 'neg' ? 'negativo e' + fmt(el.tw) + ' · PD ' + fmt(negH(room, el)) : '';
    const wpx = (el.kind === 'room' ? 400 : bb.w * v.s);
    G.text(q[0], q[1] + dy - 10 * K, l1, { size: 11 * K, font: 'serif', bold: true, fill: P.ink });
    if (wpx > 120 * K) {
      G.text(q[0], q[1] + dy + 3 * K, l2, { size: 7.5 * K, font: 'mono', fill: P.mut });
      if (l3) G.text(q[0], q[1] + dy + 14 * K, l3, { size: 7.5 * K, font: 'mono', fill: P.cor });
    }
    if (el.kind === 'rect') {
      const b = bbox(room.pts);
      dimLine(c, [bb.x0, bb.y0], [bb.x1, bb.y0], [0, -1], 0, fmt(bb.w), { color: P.dim });
      dimLine(c, [bb.x1, bb.y0], [bb.x1, bb.y1], [1, 0], 0, fmt(bb.h), { color: P.dim });
      if (bb.x0 - b.x0 > 1) dimLine(c, [b.x0, bb.y1 - 0], [bb.x0, bb.y1], [0, 1], 10, fmt(bb.x0 - b.x0), { color: P.dim, size: 7.5 });
      if (bb.y0 - b.y0 > 1) dimLine(c, [bb.x0, b.y0], [bb.x0, bb.y0], [-1, 0], 10, fmt(bb.y0 - b.y0), { color: P.dim, size: 7.5 });
      if (el.sanca && b.x1 - bb.x1 > 1) dimLine(c, [bb.x1, bb.y0 - 0], [b.x1, bb.y0], [0, -1], 10, fmt(b.x1 - bb.x1), { color: P.dim, size: 7.5 });
      if (el.sanca && b.y1 - bb.y1 > 1) dimLine(c, [bb.x1, bb.y1], [bb.x1, b.y1], [1, 0], 22, fmt(b.y1 - bb.y1), { color: P.dim, size: 7.5 });
    }
  }
  /* vigas: retângulo tracejado ligando duas paredes */
  LY(c, 'TG_VIGAS');
  for (const bm of (room.beams || [])) {
    const r = beamRect(bm), sel = o.selBeam === bm.id;
    const x = v.X(r.x0), y = v.Y(r.y1), w = (r.x1 - r.x0) * v.s, h = (r.y1 - r.y0) * v.s;
    G.rect(x, y, w, h, { fill: P.paper, stroke: sel ? P.sel : P.ink, w: (sel ? 2.2 : 1.2) * K, dash: [6 * K, 3 * K] });
    G.line(x, y, x + w, y + h, { stroke: P.faint, w: 0.6 * K });
    G.line(x + w, y, x, y + h, { stroke: P.faint, w: 0.6 * K });
    G.text(x + w / 2, y + h / 2 - (bm.o === 'h' ? 9 * K : 0), bm.name, { size: 7.4 * K, bold: true, fill: P.ink });
    if (c.hit) G.hitRect(x - 8, y - 8, w + 16, h + 16, 'b:' + bm.id);
    if (sel) {
      if (bm.o === 'h') { dimLine(c, [r.x0, r.y1], [r.x1, r.y1], [0, 1], 6, fmt(r.x1 - r.x0), { color: P.dim }); dimLine(c, [r.x1, r.y0], [r.x1, r.y1], [1, 0], 6, fmt(bm.t), { color: P.dim, size: 7.5 }); }
      else { dimLine(c, [r.x1, r.y0], [r.x1, r.y1], [1, 0], 6, fmt(r.y1 - r.y0), { color: P.dim }); dimLine(c, [r.x0, r.y0], [r.x1, r.y0], [0, -1], 6, fmt(bm.t), { color: P.dim, size: 7.5 }); }
    }
  }
}

/* ---------- parede em vista frontal ---------- */
/* bacia sanitária em vista frontal: caixa acoplada em cima, bacia embaixo */
function bacia(c, cx, cy, w, h, col) {
  const { G, K, P } = c;
  const x0 = cx - w / 2, y0 = cy - h / 2, st = { fill: P.paper, stroke: col, w: 1.4 * K };
  const th = h * 0.46, bw = w * 0.78, bx = cx - bw / 2, by = y0 + th + 1.5 * K, bh = h - th - 1.5 * K;
  G.rect(x0, y0, w, th, st);
  G.poly([[bx, by], [bx + bw, by], [bx + bw, by + bh * 0.55], [cx + bw * 0.34, by + bh], [cx - bw * 0.34, by + bh], [bx, by + bh * 0.55]], st);
  G.line(bx, by, bx + bw, by, { stroke: col, w: 1 * K });
}
function glyph(c, it, cx, cy, o) {
  const { G, v, K, P } = c;
  const t = LIBMAP[it.type], cat = t.cat;
  const col = cat === 'cor' ? (it.color || P.cor) : P[cat];
  const min = 15 * K;
  let wpx = Math.max(it.w * v.s, min), hpx = Math.max(it.h * v.s, min);
  const small = it.w <= 150 && it.h <= 150;
  const st = { fill: P.paper, stroke: col, w: 1.5 * K };
  const code = it.type === 'coringa' ? (it.name || '?').trim().slice(0, 2).toUpperCase() : t.code;
  if (it.type === 'bacia') { LY(c, CATLAYER.hid); wpx = it.w * v.s; hpx = it.h * v.s; bacia(c, cx, cy, wpx, hpx, col); return { wpx, hpx }; }
  if (G.sym) {
    const circ = (cat === 'hid' && small) || (cat === 'cor' && it.shape === 'circle');
    if (circ) wpx = hpx = Math.max(wpx, hpx);
    LY(c, CATLAYER[cat]);
    G.sym(circ ? 'TG_CIRC' : cat === 'cor' ? 'TG_CORINGA' : 'TG_RET', cx, cy, wpx, hpx);
    G.text(cx, cy, code, { size: 7.4 * K, bold: true, fill: col });
    return { wpx, hpx };
  }
  else if (cat === 'cor' && it.shape === 'circle') { const r = Math.max(wpx, hpx) / 2; G.circle(cx, cy, r, Object.assign({}, st, { dash: [3 * K, 2 * K] })); wpx = hpx = 2 * r; }
  else if (cat === 'cor') G.rect(cx - wpx / 2, cy - hpx / 2, wpx, hpx, Object.assign({}, st, { dash: [3 * K, 2 * K] }));
  if (cat === 'hid' && small) { const r = Math.max(wpx, hpx) / 2; G.circle(cx, cy, r, st); wpx = hpx = 2 * r; }
  else G.rect(cx - wpx / 2, cy - hpx / 2, wpx, hpx, Object.assign({}, st, { r: cat === 'ar' ? 3 * K : 0 }));
  if (cat === 'ar' && it.type === 'evap' && wpx > 40 * K) {
    G.line(cx - wpx / 2 + 4 * K, cy + hpx / 2 - 4 * K, cx + wpx / 2 - 4 * K, cy + hpx / 2 - 4 * K, { stroke: col, w: 0.8 * K });
  }
  G.text(cx, cy - (cat === 'ar' && it.type === 'evap' ? 2 * K : 0), code, { size: 7.4 * K, bold: true, fill: col });
  return { wpx, hpx };
}

function drawOpeningFront(c, it, tag, sel) {
  const { G, v, K, P } = c;
  const b = itemBox(it);
  const x0 = v.X(b.x0), x1 = v.X(b.x1), yt = v.Y(b.z1), yb = v.Y(b.z0);
  const w = x1 - x0, h = yb - yt;
  const st = { stroke: sel ? P.sel : P.ink, w: (sel ? 2.4 : 1.6) * K };
  const t = it.type;
  const fr = Math.min(3.4 * K, w / 6, h / 6);
  if (t === 'vao') { G.rect(x0, yt, w, h, Object.assign({ fill: P.paper }, st, { dash: [4 * K, 2.5 * K] })); }
  else if (t === 'janela' || t === 'janela-correr') {
    G.rect(x0, yt, w, h, Object.assign({ fill: P.glass }, st));
    G.rect(x0 + fr, yt + fr, w - 2 * fr, h - 2 * fr, { fill: P.glass, stroke: P.ink, w: 0.7 * K });
    if (t === 'janela') {
      G.line(x0 + fr, yt + fr, x0 + w * 0.45, yt + h * 0.45, { stroke: P.mut, w: 0.6 * K });
      G.line(x0 + fr, yb - fr, x0 + w * 0.45, yb - h * 0.55, { stroke: P.mut, w: 0.6 * K });
    } else {
      G.line(x0 + w / 2, yt + fr, x0 + w / 2, yb - fr, { stroke: P.ink, w: 0.8 * K });
      G.line(x0 + w * 0.2, yt + h * 0.5, x0 + w * 0.36, yt + h * 0.5, { stroke: P.mut, w: 0.9 * K });
    }
    G.line(x0 - 3 * K, yb + 1.2 * K, x1 + 3 * K, yb + 1.2 * K, { stroke: P.ink, w: 1.6 * K });
  } else if (t === 'porta-correr' || t === 'porta-janela') {
    G.rect(x0, yt, w, h, Object.assign({ fill: t === 'porta-janela' ? P.glass : P.door }, st));
    G.line(x0 + w / 2, yt, x0 + w / 2, yb, { stroke: P.ink, w: 0.9 * K });
    G.rect(x0 + w * 0.06, yt + h * 0.06, w * 0.38, h * 0.88, { stroke: P.mut, w: 0.5 * K });
    G.rect(x0 + w * 0.56, yt + h * 0.06, w * 0.38, h * 0.88, { stroke: P.mut, w: 0.5 * K });
    G.line(x0 + w * 0.2, yt + h * 0.5, x0 + w * 0.36, yt + h * 0.5, { stroke: P.ink, w: 1 * K });
  } else {
    G.rect(x0, yt, w, h, Object.assign({ fill: P.door }, st));
    const dash = [4 * K, 2.5 * K];
    const two = t === 'porta-giro2';
    const tri = (xa, xb) => { G.line(xa, (yt + yb) / 2, xb, yt, { stroke: P.ink, w: 0.8 * K, dash }); G.line(xa, (yt + yb) / 2, xb, yb, { stroke: P.ink, w: 0.8 * K, dash }); };
    /* vértice do triângulo no lado oposto à dobradiça, em linha tracejada */
    if (two) { G.line(x0 + w / 2, yt, x0 + w / 2, yb, { stroke: P.ink, w: 0.9 * K }); tri(x0 + w / 2, x0); tri(x0 + w / 2, x1); }
    else if ((it.hinge || 'L') === 'L') tri(x1, x0); else tri(x0, x1);
    const hx = two ? [x0, x1] : [(it.hinge || 'L') === 'L' ? x0 : x1];
    for (const x of hx) for (const f of [0.2, 0.8]) G.rect(x - 1.2 * K, yt + h * f - 2 * K, 2.4 * K, 4 * K, { fill: P.ink });
  }
  if (tag) G.text((x0 + x1) / 2, yt + 9 * K, tag, { size: 8.5 * K, bold: true, fill: P.ink });
  if (c.hit) G.hitRect(x0 - 2, yt - 2, w + 4, h + 4, 'i:' + it.id);
}

/* corrente horizontal de cotas; textos que não cabem sobem em degraus, sem colidir */
function hChain(c, xs, yw, nsign, offK, colors, o) {
  const { G, v, K, P } = c;
  o = o || {};
  const fs = (o.size || 7.2) * K;
  const its = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 1) continue;
    const txt = fmt(b - a);
    its.push({ a, b, txt, wpx: (b - a) * v.s, tw: textW(txt, fs, { font: 'mono' }) + 5 * K, mx: (v.X(a) + v.X(b)) / 2, col: colors[Math.min(i, colors.length - 1)], lvl: 0 });
  }
  const occ = []; let mxl = 0;
  for (const it of its) {
    for (let l = 0; ; l++) {
      if (l === 0 && it.wpx < it.tw) continue;
      const iv = [it.mx - it.tw / 2, it.mx + it.tw / 2];
      occ[l] = occ[l] || [];
      if (!occ[l].some(q => iv[0] < q[1] && q[0] < iv[1])) { occ[l].push(iv); it.lvl = l; mxl = Math.max(mxl, l); break; }
    }
  }
  const lineY = v.Y(yw) - nsign * offK * K;
  for (const it of its) {
    dimLine(c, [it.a, yw], [it.b, yw], [0, nsign], offK, '', { color: it.col });
    const ty = lineY - nsign * (fs * 0.72 + 1.5 * K + it.lvl * fs * 1.08);
    if (it.lvl > 0) G.line(it.mx, lineY, it.mx, ty + nsign * fs * 0.5, { stroke: it.col, w: 0.5 * K });
    G.text(it.mx, ty, it.txt, { size: fs, font: 'mono', fill: it.col });
  }
  return mxl;
}
/* cotas de todos os pontos (PDF): correntes por fileira, sem colisão */
function ptDimsAll(c, pts, L) {
  const { G, v, K, P } = c;
  const fs = 7.2 * K;
  /* cotas: elétrica em nogueira, hidráulica em azul; coringa mede pelas bordas, não pelo eixo */
  const colOf = it => { const cat = LIBMAP[it.type].cat; return cat === 'cor' ? P.dim : P[cat]; };
  const refsOf = it => it.type === 'coringa' ? [it.u - it.w / 2, it.u + it.w / 2] : [it.u];
  const info = pts.map(it => ({ it, cat: LIBMAP[it.type].cat, refs: refsOf(it), cz: it.type === 'coringa' ? it.z - it.h / 2 : zc(it), cy: v.Y(zc(it)), half: Math.max(it.h * v.s, 15 * K) / 2, col: colOf(it) }));
  /* cada ponto é cotado sozinho, da extremidade esquerda e da direita da parede ao ponto (nunca de um ponto a outro) */
  const gl = info.map(i => ({ i, x0: v.X(i.it.u) - Math.max(i.it.w * v.s, 15 * K) / 2 - 2 * K, x1: v.X(i.it.u) + Math.max(i.it.w * v.s, 15 * K) / 2 + 2 * K, y0: i.cy - i.half - 11 * K, y1: i.cy + i.half + 2 * K }));
  const used = [];
  const floorY = v.Y(0);
  const tH = fs * 1.5 + 2 * K;
  for (const i of info.slice().sort((a, b) => b.cz - a.cz)) {
    const z = i.it.type === 'coringa' ? i.it.z : zc(i.it);
    const spans = [[0, i.refs[0]], [i.refs[i.refs.length - 1], L]];
    for (const [a, b] of spans) {
      if (b - a < 1) continue;
      const txt = fmt(b - a), tw = textW(txt, fs, { font: 'mono' }) + 6 * K;
      const xa = v.X(a), xb = v.X(b), mid = (xa + xb) / 2, hw = Math.max(Math.abs(xb - xa), tw) / 2;
      let pick = 0;
      for (let k = 0; k < 40; k++) {
        const off = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 11;
        const yb = v.Y(z) - off * K, y0 = yb - tH, y1 = yb + 3 * K;
        if (y1 > floorY - 1 * K) continue;
        const clash = used.some(q => mid - hw < q[1] && q[0] < mid + hw && y0 < q[3] && q[2] < y1)
          || gl.some(q => q.i !== i && Math.min(xa, xb) < q.x1 && q.x0 < Math.max(xa, xb) && y0 < q.y1 && q.y0 < y1);
        if (!clash) { pick = off; used.push([mid - hw, mid + hw, y0, y1]); break; }
        if (k === 39) { pick = off; used.push([mid - hw, mid + hw, y0, y1]); }
      }
      dimLine(c, [a, z], [b, z], [0, 1], pick, txt, { color: i.col, tcolor: i.col, size: 7.2 });
    }
  }
  /* alturas: do piso até o ponto (até a base, no dreno) */
  const cols2 = info.slice().sort((a, b) => a.it.u - b.it.u);
  const vg = [];
  for (const i of cols2) { const l = vg[vg.length - 1]; if (l && Math.abs(l[0].it.u - i.it.u) <= 5) l.push(i); else vg.push([i]); }
  let side = 1;
  for (let gi = 0; gi < vg.length; gi++) {
    const g = vg[gi], x = v.X(g[0].it.u);
    const prevClose = gi > 0 && x - v.X(vg[gi - 1][0].it.u) < 16 * K, nextClose = gi < vg.length - 1 && v.X(vg[gi + 1][0].it.u) - x < 16 * K;
    side = prevClose ? -side : (nextClose ? -1 : 1);
    g.sort((a, b) => a.it.z - b.it.z).forEach((i, k) => {
      const ac = { color: i.col, tcolor: i.col, size: 7.2, tpos: 0.2 };
      const zt = i.it.type === 'coringa' ? i.it.z - i.it.h / 2 : i.it.z;
      dimLine(c, [i.it.u, 0], [i.it.u, zt], [side, 0], k * 12, fmt(zt), ac);
    });
  }
}
function hChainLevels(c, xs, fs) {
  const { v, K } = c; const occ = []; let mx = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const wpx = (xs[i + 1] - xs[i]) * v.s, tw = textW(fmt(xs[i + 1] - xs[i]), fs, { font: 'mono' }) + 5 * K, m = (v.X(xs[i]) + v.X(xs[i + 1])) / 2;
    for (let l = 0; ; l++) {
      if (l === 0 && wpx < tw) continue;
      occ[l] = occ[l] || [];
      const iv = [m - tw / 2, m + tw / 2];
      if (!occ[l].some(q => iv[0] < q[1] && q[0] < iv[1])) { occ[l].push(iv); mx = Math.max(mx, l); break; }
    }
  }
  return mx;
}
function drawWall(c, room, wi, o) {
  o = o || {};
  const { G, v, K, P } = c;
  const g = wallGeom(room, wi), L = g.L, H = room.H;
  const X0 = v.X(0), X1 = v.X(L), YT = v.Y(H), YB = v.Y(0);
  const lab = labelsFor(room);
  G.rect(X0, YT, X1 - X0, YB - YT, { fill: P.floor, stroke: 'none' });
  /* marcações livres (divisão de revestimento etc.) */
  LY(c, 'TG_MARCACOES');
  for (const m of (room.marks || [])) {
    if (m.wall !== wi) continue;
    const st = { stroke: P.ink, w: 1 * K, dash: [8 * K, 3 * K, 2 * K, 3 * K] };
    if (m.o === 'v') {
      const x = v.X(m.pos); G.line(x, YT, x, YB, st);
      if (c.hit) G.hitLine(x, YT, x, YB, 'mk:' + m.id, 16);
      G.text(x + 3 * K, YT + 9 * K, fmt(m.pos), { size: 7 * K, font: 'mono', fill: P.dim });
    } else {
      const y = v.Y(m.pos); G.line(X0, y, X1, y, st);
      if (c.hit) G.hitLine(X0, y, X1, y, 'mk:' + m.id, 16);
      G.text(X0 + 3 * K, y - 5 * K, fmt(m.pos), { size: 7 * K, font: 'mono', fill: P.dim });
    }
  }
  /* vigas que encostam nesta parede (tracejado) */
  LY(c, 'TG_VIGAS');
  for (const bm of (room.beams || [])) {
    const r = beamRect(bm), us = [], tol = 3;
    for (const p of [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]) {
      const rel = [p[0] - g.A[0], p[1] - g.A[1]], dist = Math.abs(rel[0] * g.nin[0] + rel[1] * g.nin[1]), u = rel[0] * g.d[0] + rel[1] * g.d[1];
      if (dist < tol && u > -tol && u < g.L + tol) us.push(u);
    }
    if (us.length < 2) continue;
    const u0 = Math.max(0, Math.min(...us)), u1 = Math.min(g.L, Math.max(...us));
    if (u1 - u0 < 1) continue;
    G.rect(v.X(u0), v.Y(room.H), (u1 - u0) * v.s, (room.H - bm.z) * v.s, { fill: P.paper, stroke: P.ink, w: 1.1 * K, dash: [5 * K, 3 * K] });
    G.text(v.X((u0 + u1) / 2), v.Y((room.H + bm.z) / 2), bm.name + ' · h ' + fmt(room.H - bm.z), { size: 7 * K, font: 'mono', fill: P.mut });
  }
  /* chão */
  G.line(X0 - 14 * K, YB, X1 + 14 * K, YB, { stroke: P.ink, w: 2 * K });
  for (let x = X0 - 10 * K; x < X1 + 12 * K; x += 7 * K) G.line(x, YB + 0.5 * K, x - 4.5 * K, YB + 5 * K, { stroke: P.faint, w: 0.7 * K });
  /* forro */
  LY(c, 'TG_FORRO');
  for (const e of ceilOnWall(room, wi)) {
    const el = e.el, xa = v.X(e.u0), xb = v.X(e.u1);
    const dropPx = el.drop * v.s, y1 = YT + dropPx;
    if (el.drop > 0) {
      const poly = [[xa, YT], [xb, YT], [xb, y1], [xa, y1]];
      if (e.touching) { G.poly(poly, { fill: P.gesso, stroke: P.gessoLn, w: 1 * K }); hatchPoly(c, poly, 5 * K, P.faint, 45); G.line(xa, y1, xb, y1, { stroke: P.ink, w: 1.5 * K }); }
      else { G.poly(poly, { fill: P.gesso, stroke: P.gessoLn, w: 1 * K, dash: [4 * K, 2.5 * K] }); hatchPoly(c, poly, 5 * K, P.faint, 135); }
      const lbl = (e.touching ? 'forro ' : 'forro a ' + fmt(e.dist) + ' · ') + (e.touching ? '−' : 'rebaixo ') + fmt(el.drop);
      if (xb - xa > textW(lbl, 7 * K, { font: 'mono' }) + 8 * K && dropPx > 8 * K) G.text((xa + xb) / 2, YT + dropPx / 2, lbl, { size: 7 * K, font: 'mono', fill: P.mut });
    }
    if (e.touching && el.trim === 'neg') {
      LY(c, 'TG_NEGATIVO');
      const ytop = v.Y(negH(room, el));
      if (ytop < y1 - 1) {
        const poly = [[xa, ytop], [xb, ytop], [xb, y1], [xa, y1]];
        G.poly(poly, { fill: P.neg, stroke: P.ink, w: 0.9 * K });
        const lbl = 'negativo e' + fmt(el.tw) + ' · PD ' + fmt(negH(room, el));
        G.text(xa + 4 * K, ytop - 5 * K, lbl, { size: 6.8 * K, font: 'mono', fill: P.cor, anchor: 'start' });
      }
    } else if (e.touching && el.trim === 'roda') {
      LY(c, 'TG_RODAFORRO');
      const th = Math.max(el.th * v.s, 3 * K);
      const poly = [[xa, y1], [xb, y1], [xb, y1 + th], [xa, y1 + th]];
      G.poly(poly, { fill: P.roda, stroke: P.cor, w: 1 * K });
      const lbl = 'rodaforro e' + fmt(el.tw) + ' × h' + fmt(el.th);
      const maxDrop = Math.max(0, ...ceilOnWall(room, wi).map(q => q.el.drop)) * v.s;
      G.text(xa + 4 * K, YT + Math.max(y1 - YT, maxDrop) + th + 8 * K, lbl, { size: 6.8 * K, font: 'mono', fill: P.cor, anchor: 'start' });
    }
  }
  /* contorno da parede */
  LY(c, 'TG_PAREDES');
  G.rect(X0, YT, X1 - X0, YB - YT, { stroke: P.ink, w: 2 * K });
  const items = itemsOn(room, wi);
  LY(c, 'TG_ESQUADRIAS');
  for (const it of items) if (it.kind === 'op') drawOpeningFront(c, it, lab.tags[it.id], o.sel === it.id);
  for (const it of items) if (it.kind === 'pt') {
    const b = itemBox(it);
    const cx = v.X(it.u), cy = v.Y(zc(it));
    const sel = o.sel === it.id;
    const isCor = it.type === 'coringa';
    const gl = glyph(c, isCor && sel ? Object.assign({}, it, { color: P.sel }) : it, cx, cy, o);
    LY(c, 'TG_TEXTO');
    if (sel && !isCor) G.rect(cx - gl.wpx / 2 - 3 * K, cy - gl.hpx / 2 - 3 * K, gl.wpx + 6 * K, gl.hpx + 6 * K, { stroke: P.sel, w: 1.6 * K, dash: [3 * K, 2 * K] });
    G.text(cx, cy - gl.hpx / 2 - 6.5 * K, String(lab.nums[it.id]), { size: 7.6 * K, bold: true, fill: P.ink });
    if (!o.ptDims) G.text(cx, cy + gl.hpx / 2 + 6.5 * K, fmt(it.z), { size: 6.6 * K, font: 'mono', fill: P.mut });
    if (c.hit) G.hitRect(cx - Math.max(gl.wpx / 2, 11), cy - Math.max(gl.hpx / 2, 11), Math.max(gl.wpx, 22), Math.max(gl.hpx, 22), 'i:' + it.id);
  }
  /* cotas horizontais acima da parede */
  const up = [0, 1], ops = items.filter(i => i.kind === 'op'), pts = items.filter(i => i.kind === 'pt');
  let off = 12 + wallTopExtra(room) * v.s / K;
  if (ops.length) {
    const ch = chainSegs(room, wi);
    for (const s of ch.segs) dimLine(c, [s.a, H], [s.b, H], up, off, fmt(s.b - s.a), { src: s.src });
    off += 15;
  }
  dimLine(c, [0, H], [L, H], up, off, fmt(L), { src: room.wsrc[wi], bold: true });
  dimLine(c, [0, 0], [0, H], [-1, 0], 14, fmt(H), { src: room.Hsrc, bold: true });
  /* cotas de cada ponto, na cor da sua categoria (PDF) */
  if (o.ptDims && pts.length) ptDimsAll(c, pts, L);
  /* cotas verticais das esquadrias */
  for (const it of ops) {
    if (!(o.allDims || o.sel === it.id)) continue;
    const xr = it.u + it.w, tx = [1, 0];
    if (it.z > 1) dimLine(c, [xr, 0], [xr, it.z], tx, 7, fmt(it.z), { src: it.src, size: 7.6 });
    dimLine(c, [xr, it.z], [xr, it.z + it.h], tx, 7, fmt(it.h), { src: it.src, size: 7.6 });
    if (H - (it.z + it.h) > 1) dimLine(c, [xr, it.z + it.h], [xr, H], tx, 7, fmt(H - it.z - it.h), { color: P.mut, tcolor: P.mut, size: 7.6 });
  }
  /* guias do item selecionado */
  if (o.sel) {
    const it = room.items.find(i => i.id === o.sel && i.wall === wi);
    if (it) {
      const b = itemBox(it), cz = it.kind === 'op' ? (b.z0 + b.z1) / 2 : zc(it), cu = it.kind === 'op' ? it.u : it.u;
      const ac = { color: P.sel, tcolor: P.sel, size: 8 };
      if (it.kind === 'pt') {
        dimLine(c, [0, cz], [it.u, cz], [0, -1], 0, fmt(it.u), Object.assign({ src: it.src }, ac));
        dimLine(c, [it.u, cz], [L, cz], [0, -1], 0, fmt(L - it.u), ac);
        dimLine(c, [it.u, 0], [it.u, it.zb ? it.z : cz], [1, 0], 0, fmt(it.z), ac);
        dimLine(c, [it.u, it.zb ? it.z + it.h : cz], [it.u, H], [1, 0], 0, fmt(H - (it.zb ? it.z + it.h : it.z)), ac);
      } else {
        dimLine(c, [0, cz], [it.u, cz], [0, -1], 0, fmt(it.u), Object.assign({ src: it.src }, ac));
        dimLine(c, [it.u + it.w, cz], [L, cz], [0, -1], 0, fmt(L - it.u - it.w), ac);
      }
    }
  }
}

/* miniatura da planta com a parede em destaque e o sentido da vista */
function drawMini(c, room, wi) {
  const { G, K, P } = c;
  G.poly(polyDev(c, room.pts), { fill: P.floor, stroke: P.ink, w: 1.1 * K });
  const g = wallGeom(room, wi);
  G.line(...dev(c, g.A), ...dev(c, g.B), { stroke: P.sel, w: 3.2 * K });
  const m = vadd(g.A, vmul(g.d, g.L / 2));
  const from = vadd(m, vmul(g.nin, 16 * K / c.v.s)), to = vadd(m, vmul(g.nin, 3 * K / c.v.s));
  const a = dev(c, from), b = dev(c, to);
  G.line(a[0], a[1], b[0], b[1], { stroke: P.sel, w: 1.1 * K });
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  G.poly([[b[0], b[1]], [b[0] - ux * 5 * K - uy * 2.8 * K, b[1] - uy * 5 * K + ux * 2.8 * K], [b[0] - ux * 5 * K + uy * 2.8 * K, b[1] - uy * 5 * K - ux * 2.8 * K]], { fill: P.sel });
}

/* ---------- fotos com cotas ---------- */
function drawAnn(c, an, x0, y0, W, sel) {
  const { G, K, P } = c;
  const a = [x0 + an.x1 * W, y0 + an.y1 * W], b = [x0 + an.x2 * W, y0 + an.y2 * W];
  const col = an.color || '#F2C200';
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const wl = (sel ? 3.2 : 2.4) * K;
  const halo = { stroke: '#000000', w: wl + 1.4 * K };
  const main = { stroke: col, w: wl };
  G.line(a[0], a[1], b[0], b[1], halo);
  if (an.kind === 'arrow') {
    for (const [p, s] of [[a, 1], [b, -1]]) {
      const tip = p, bx = p[0] + s * ux * 11 * K, by = p[1] + s * uy * 11 * K;
      G.poly([tip, [bx - uy * 4.6 * K, by + ux * 4.6 * K], [bx + uy * 4.6 * K, by - ux * 4.6 * K]], { fill: col, stroke: '#000000', w: 0.8 * K });
    }
  } else {
    for (const p of [a, b]) G.line(p[0] - uy * 8 * K, p[1] + ux * 8 * K, p[0] + uy * 8 * K, p[1] - ux * 8 * K, { stroke: '#000000', w: wl + 1.4 * K });
  }
  G.line(a[0], a[1], b[0], b[1], main);
  if (an.kind !== 'arrow') for (const p of [a, b]) G.line(p[0] - uy * 8 * K, p[1] + ux * 8 * K, p[0] + uy * 8 * K, p[1] - ux * 8 * K, main);
  const text = an.lbl || (an.mm > 0 ? fmt(an.mm) : (an.kind === 'arrow' ? '' : '?'));
  if (!text) { if (c.hit) G.hitLine(a[0], a[1], b[0], b[1], 'a:' + an.id, 22); if (sel && c.hit) for (const [p, k] of [[a, 1], [b, 2]]) { G.circle(p[0], p[1], 7, { fill: '#FFFFFF', stroke: col, w: 2 }); G.circle(p[0], p[1], 16, { fill: 'rgba(0,0,0,0.001)', stroke: 'none', pe: 'all', id: 'h:' + an.id + ':' + k }); } return; }
  const fs = 10.5 * K, tw = textW(text, fs, { font: 'mono', bold: true }) + 10 * K, th = fs + 6 * K;
  let ang = Math.atan2(dy, dx); let deg = ang * 180 / Math.PI;
  if (deg > 90) deg -= 180; if (deg < -90) deg += 180;
  const rad = deg * Math.PI / 180, ct = Math.cos(rad), st = Math.sin(rad);
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const cr = (px, py) => [m[0] + px * ct - py * st, m[1] + px * st + py * ct];
  G.poly([cr(-tw / 2, -th / 2), cr(tw / 2, -th / 2), cr(tw / 2, th / 2), cr(-tw / 2, th / 2)], { fill: col, stroke: '#000000', w: 0.9 * K });
  G.text(m[0], m[1], text, { size: fs, rot: deg, font: 'mono', bold: true, fill: lum(col) > 0.55 ? '#111111' : '#FFFFFF' });
  if (an.src === 'laser') checkMark(c, cr(-tw / 2 - 6 * K, 0)[0], cr(-tw / 2 - 6 * K, 0)[1], 7 * K, col, deg);
  if (c.hit) G.hitLine(a[0], a[1], b[0], b[1], 'a:' + an.id, 22);
  if (sel && c.hit) for (const [p, k] of [[a, 1], [b, 2]]) { G.circle(p[0], p[1], 7, { fill: '#FFFFFF', stroke: col, w: 2 }); G.circle(p[0], p[1], 16, { fill: 'rgba(0,0,0,0.001)', stroke: 'none', pe: 'all', id: 'h:' + an.id + ':' + k }); }
}
function drawPhoto(c, ph, x0, y0, W, selAnn) {
  const H = W * ph.h / ph.w;
  c.G.image(x0, y0, W, H, ph.id);
  for (const an of ph.ann) drawAnn(c, an, x0, y0, W, an.id === selAnn);
  return H;
}

/* ---------- logotipo (vetor) ---------- */
function drawLogo(G, x, y, width, o) {
  o = o || {};
  const vb = LOGO.vb;
  const x1 = o.mark ? LOGO.markX1 : vb[0] + vb[2];
  const k = width / (x1 - vb[0]);
  const m = [k, 0, 0, k, x - vb[0] * k, y - vb[1] * k];
  const col = o.colors || { ink: '#2A2826', gold: '#9C7A48', gray: '#6C665D' };
  if (G.layer) G.layer('TG_LOGO');
  for (const it of LOGO.items) {
    if (o.mark && it.r && it.r[0] > LOGO.markX1) continue;
    if (o.mark && it.f === 'gray') continue;
    const f = col[it.f];
    if (it.d) G.path(it.d, m, { fill: f });
    else G.rect(x + (it.r[0] - vb[0]) * k, y + (it.r[1] - vb[1]) * k, it.r[2] * k, it.r[3] * k, { fill: f });
  }
  return (vb[3]) * k;
}
