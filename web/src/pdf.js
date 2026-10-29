/* ===== Tégora · PDF cotado (A4 paisagem) ===== */
'use strict';

const PW = 841.89, PH = 595.28, PM = 30;
const SRC_TXT = { laser: 'trena (laser)', manual: 'manual' };

function pdfFrame(doc, ctx, title, sub, pageNo, total) {
  const G = doc.addPage(PW, PH);
  const P = PAL_PRINT;
  drawLogo(G, PM, PM - 2, 118, { colors: { ink: '#2A2826', gold: '#9C7A48', gray: '#6C665D' } });
  G.text(PW - PM, PM + 4, title, { size: 15, font: 'serif', bold: true, anchor: 'end', fill: P.ink });
  G.text(PW - PM, PM + 18, sub, { size: 8, anchor: 'end', fill: P.mut });
  G.line(PM, PM + 30, PW - PM, PM + 30, { stroke: P.accent, w: 1 });
  G.line(PM, PH - PM + 4, PW - PM, PH - PM + 4, { stroke: P.faint, w: 0.6 });
  const m = ctx.meta;
  const l1 = ['Cliente: ' + (m.nome || '—'), m.endereco].filter(Boolean).join('  ·  ');
  const l2 = [m.loja && 'Loja: ' + m.loja, m.consultor && 'Consultor: ' + m.consultor, m.arquiteto && 'Arquiteto: ' + m.arquiteto].filter(Boolean).join('  ·  ');
  G.text(PM, PH - PM + 13, l1, { size: 7.5, anchor: 'start', fill: P.ink, bold: true });
  if (l2) G.text(PM, PH - PM + 22, l2, { size: 7, anchor: 'start', fill: P.mut });
  G.text(PW / 2 + 60, PH - PM + 13, 'Unidade: ' + ctx.unit + '   ·   ✓ = medida lida pela trena; sem marca = informada manualmente'.replace('✓', 'v'), { size: 7, fill: P.mut });
  G.text(PW - PM, PH - PM + 13, (m.data || '') + '   ·   ' + pageNo + '/' + total, { size: 7.5, anchor: 'end', fill: P.mut });
  return G;
}

/* tabela simples: cols [{h, w, a}] ; devolve y final */
function pdfTable(G, x, y, cols, rows, o) {
  o = o || {};
  const P = PAL_PRINT, rh = o.rh || 13, fs = o.fs || 7.4;
  const W = cols.reduce((s, c) => s + c.w, 0);
  G.rect(x, y, W, rh, { fill: P.ink });
  let cx = x;
  for (const c of cols) {
    const tx = c.a === 'r' ? cx + c.w - 4 : cx + 4;
    G.text(tx, y + rh / 2, c.h, { size: fs, bold: true, fill: '#FFFFFF', anchor: c.a === 'r' ? 'end' : 'start' });
    cx += c.w;
  }
  y += rh;
  rows.forEach((r, k) => {
    if (k % 2) G.rect(x, y, W, rh, { fill: P.surf });
    let cx2 = x;
    cols.forEach((c, j) => {
      let s = String(r[j] == null ? '' : r[j]);
      while (s.length > 1 && textW(s, fs) > c.w - 8) s = s.slice(0, -2) + '…';
      const tx = c.a === 'r' ? cx2 + c.w - 4 : cx2 + 4;
      G.text(tx, y + rh / 2, s, { size: fs, fill: P.ink, anchor: c.a === 'r' ? 'end' : 'start' });
      cx2 += c.w;
    });
    y += rh;
  });
  G.line(x, y, x + W, y, { stroke: P.faint, w: 0.6 });
  return y;
}

function pdfLegend(G, x, y) {
  const P = PAL_PRINT;
  G.text(x, y, 'LEGENDA', { size: 7, bold: true, anchor: 'start', fill: P.accent });
  y += 11;
  const c = { G, v: new View(1, 0, 0), K: 1, P, hit: false };
  const row = (draw, label) => { draw(); G.text(x + 24, y, label, { size: 7.2, anchor: 'start', fill: P.ink }); y += 12.5; };
  row(() => { G.circle(x + 7, y, 5.5, { fill: '#FFFFFF', stroke: P.ele, w: 1.4 }); G.text(x + 7, y, 'T', { size: 6, bold: true, fill: P.ele }); }, 'Elétrica (círculo)');
  row(() => { G.rect(x + 1.5, y - 5.5, 11, 11, { fill: '#FFFFFF', stroke: P.hid, w: 1.4 }); G.text(x + 7, y, 'AF', { size: 5.5, bold: true, fill: P.hid }); }, 'Hidráulica (quadrado)');
  row(() => { G.rect(x, y - 4, 14, 8, { fill: '#FFFFFF', stroke: P.ar, w: 1.4, r: 2 }); G.text(x + 7, y, 'AC', { size: 5.5, bold: true, fill: P.ar }); }, 'Ar condicionado');
  row(() => { G.rect(x, y - 5, 14, 10, { fill: '#FFFFFF', stroke: P.cor, w: 1.2, dash: [2, 1.5] }); G.text(x + 7, y, '?', { size: 6, bold: true, fill: P.cor }); }, 'Ponto coringa');
  row(() => { G.poly([[x, y - 5], [x + 14, y - 5], [x + 14, y + 4], [x, y + 4]], { fill: P.gesso, stroke: P.gessoLn, w: 0.8 }); }, 'Forro de gesso (rebaixo)');
  row(() => { G.rect(x, y - 3, 14, 6, { fill: P.roda, stroke: P.cor, w: 0.8 }); }, 'Rodaforro');
  row(() => { G.rect(x, y - 3, 14, 6, { fill: P.neg }); }, 'Negativo (sombra)');
  row(() => { G.circle(x + 7, y, 5, { fill: '#FFFFFF', stroke: P.hid, w: 1.2 }); G.line(x + 3.5, y - 3.5, x + 10.5, y + 3.5, { stroke: P.hid, w: 0.8 }); G.line(x + 3.5, y + 3.5, x + 10.5, y - 3.5, { stroke: P.hid, w: 0.8 }); }, 'Ralo');
  row(() => { checkMark(c, x + 7, y, 7, P.dim, 0); }, 'Medida lida pela trena');
  return y;
}

function pdfPlanPage(doc, ctx, room, ri, total) {
  const G = pdfFrame(doc, ctx, 'Planta baixa · ' + room.name, 'Medidas gerais, esquadrias e pé-direito', ctx.pg(), total);
  const P = PAL_PRINT, s = roomSummary(room);
  const area = { x: PM, y: PM + 40, w: 560, h: PH - 2 * PM - 52 };
  const b = bbox(room.pts);
  const v = View.fit(b, area, 78);
  const c = { G, v, K: 1, P, hit: false };
  drawPlan(c, room, {});
  const sx = PM + 575, sw = PW - PM - sx;
  let y = PM + 44;
  G.text(sx, y, 'RESUMO DO AMBIENTE', { size: 7, bold: true, anchor: 'start', fill: P.accent });
  y += 8;
  const m2 = x => (x / 1e6).toFixed(2).replace('.', ',') + ' m²';
  const m3 = x => (x / 1e9).toFixed(2).replace('.', ',') + ' m³';
  y = pdfTable(G, sx, y, [{ h: 'Item', w: sw - 80 }, { h: 'Valor', w: 80, a: 'r' }], [
    ['Área do piso', m2(s.area)], ['Perímetro', fmt(s.per, ctx.unit, true)], ['Pé-direito', fmt(room.H, ctx.unit, true) + (room.Hsrc === 'laser' ? ' v' : '')],
    ['Parede bruta', m2(s.gross)], ['Parede líquida', m2(s.net)], ['Volume', m3(s.vol)]], { rh: 12.5 });
  y += 14;
  const ops = room.items.filter(i => i.kind === 'op').sort((a, b) => (a.wall - b.wall) || (a.u - b.u));
  const lab = labelsFor(room);
  G.text(sx, y, 'ESQUADRIAS', { size: 7, bold: true, anchor: 'start', fill: P.accent });
  y += 8;
  if (ops.length) {
    y = pdfTable(G, sx, y, [{ h: 'Id', w: 22 }, { h: 'Tipo', w: sw - 22 - 24 - 46 - 38 }, { h: 'Par.', w: 24 }, { h: 'L × A', w: 46 + 38, a: 'r' }],
      ops.map(i => [lab.tags[i.id], i.name, wnum(room, i.wall), fmt(i.w) + '×' + fmt(i.h)]), { rh: 12.5, fs: 7 });
    y += 4;
    G.text(sx, y + 4, 'Peitoril (z) e distâncias: ver a vista de cada parede.', { size: 6.5, anchor: 'start', fill: P.mut });
    y += 12;
  } else { G.text(sx, y + 6, 'Sem esquadrias lançadas.', { size: 7.4, anchor: 'start', fill: P.mut }); y += 16; }
  y += 12;
  y = pdfLegend(G, sx, y);
  const notes = [];
  if (ri === 0 && ctx.meta.obs) notes.push('Cliente: ' + ctx.meta.obs);
  if (room.obs) notes.push(room.obs);
  if (notes.length) {
    y += 8;
    G.text(sx, y, 'OBSERVAÇÕES DA MEDIÇÃO', { size: 7, bold: true, anchor: 'start', fill: P.accent });
    y += 10;
    for (const n of notes) for (const ln of wrapText(n, sw, 7)) { if (y > PH - PM - 4) break; G.text(sx, y, ln, { size: 7, anchor: 'start', fill: P.ink }); y += 9; }
  }
}
function wrapText(t, w, size) {
  const out = [];
  for (const para of String(t).split(/\n/)) {
    let cur = '';
    for (const wd of para.split(/\s+/)) {
      const nx = cur ? cur + ' ' + wd : wd;
      if (textW(nx, size) > w && cur) { out.push(cur); cur = wd; } else cur = nx;
    }
    out.push(cur);
  }
  return out;
}

function pdfCeilPage(doc, ctx, room, total) {
  const G = pdfFrame(doc, ctx, 'Forro de gesso · ' + room.name, 'Rebaixos, rodaforro e negativos (vista de cima)', ctx.pg(), total);
  const P = PAL_PRINT;
  const area = { x: PM, y: PM + 40, w: 560, h: PH - 2 * PM - 52 };
  const v = View.fit(bbox(room.pts), area, 78);
  drawCeil({ G, v, K: 1, P, hit: false }, room, {});
  const sx = PM + 575, sw = PW - PM - sx;
  let y = PM + 44;
  G.text(sx, y, 'ELEMENTOS DO FORRO', { size: 7, bold: true, anchor: 'start', fill: P.accent });
  y += 8;
  const rows = room.ceil.map(e => [e.name + (e.sanca ? ' (sanca)' : '') + (e.eo && e.eo.some(q => q) ? ' *' : ''), e.drop ? fmt(e.drop) : 'rente', e.trim === 'roda' ? 'Roda ' + fmt(e.tw) + '×' + fmt(e.th) : e.trim === 'neg' ? 'Neg. e' + fmt(e.tw) + ' PD ' + fmt(negH(room, e)) : '—']);
  y = pdfTable(G, sx, y, [{ h: 'Elemento', w: sw - 62 - 78 }, { h: 'Rebaixo', w: 62, a: 'r' }, { h: 'Acabamento', w: 78 }], rows, { rh: 13, fs: 7 });
  y += 14;
  const lines = [
    'Rebaixo = distância da laje até o forro.',
    'Altura do forro = pé-direito ' + fmt(room.H, ctx.unit, true) + ' − rebaixo.',
    'Rodaforro: peça aparente no perímetro.',
    'Negativo: canal de sombra; PD do negativo = altura até o topo do canal.',
    '* arestas recuadas (sanca): afastamento indicado na planta.',
  ];
  lines.forEach((t, k) => G.text(sx, y + k * 11, t, { size: 7, anchor: 'start', fill: P.mut }));
  pdfLegend(G, sx, y + 60);
}

function pdfWallPage(doc, ctx, room, wi, total) {
  const g = wallGeom(room, wi);
  const G = pdfFrame(doc, ctx, 'Parede ' + wnum(room, wi) + ' · ' + room.name, 'Vista frontal · comprimento ' + fmt(g.L, ctx.unit, true) + ' · pé-direito ' + fmt(room.H, ctx.unit, true), ctx.pg(), total);
  const P = PAL_PRINT;
  const items = itemsOn(room, wi);
  const lab = labelsFor(room);
  const nRows = items.length;
  const tblH = Math.min(nRows, 12) * 12 + 40;
  const area = { x: PM, y: PM + 38, w: PW - 2 * PM, h: PH - 2 * PM - 48 - (nRows ? tblH + 6 : 0) };
  const v = View.fit({ x0: 0, y0: 0, x1: g.L, y1: room.H + wallTopExtra(room) }, area, 0);
  /* margens para as cotas: reduz a escala */
  const padL = 46, padT = 62, padR = 56, padB = 22;
  const box = { x: area.x + padL, y: area.y + padT, w: area.w - padL - padR - 112, h: area.h - padT - padB };
  const vv = View.fit({ x0: 0, y0: 0, x1: g.L, y1: room.H + wallTopExtra(room) }, box, 0);
  drawWall({ G, v: vv, K: 1, P, hit: false }, room, wi, { allDims: true, ptDims: true });
  /* miniatura */
  const mw = 100, mh = 80, mx = PW - PM - mw, my = area.y + 4;
  G.text(mx, my, 'POSIÇÃO NA PLANTA', { size: 6.5, bold: true, anchor: 'start', fill: P.accent });
  const mv = View.fit(bbox(room.pts), { x: mx, y: my + 6, w: mw, h: mh }, 6);
  drawMini({ G, v: mv, K: 1, P, hit: false }, room, wi);
  G.text(mx, my + mh + 16, 'Seta: sentido da vista', { size: 6.3, anchor: 'start', fill: P.mut });
  /* tabela */
  if (nRows) {
    const ty = PH - PM - 4 - tblH + 6;
    const cols = [{ h: 'Id', w: 30 }, { h: 'Item', w: 190 }, { h: 'Cat.', w: 80 }, { h: 'Dist. esq.', w: 70, a: 'r' }, { h: 'Dist. dir.', w: 70, a: 'r' }, { h: 'Altura (z)', w: 70, a: 'r' }, { h: 'L × A', w: 90, a: 'r' }, { h: 'Origem', w: 70 }];
    const rows = items.slice(0, 12).map(it => {
      const tid = it.kind === 'op' ? lab.tags[it.id] : String(lab.nums[it.id]);
      const left = it.kind === 'op' ? it.u : it.u - it.w / 2, right = g.L - (it.kind === 'op' ? it.u + it.w : it.u + it.w / 2);
      const cat = CATS.find(c => c.id === LIBMAP[it.type].cat).short;
      return [tid, it.name, cat, fmt(left), fmt(right), it.kind === 'op' ? (it.z ? fmt(it.z) : 'piso') : fmt(it.z), fmt(it.w) + '×' + fmt(it.h), SRC_TXT[it.src] || 'manual'];
    });
    pdfTable(G, PM, ty, cols, rows, { rh: 12, fs: 7 });
    if (nRows > 12) G.text(PM, ty + 12 * 13 + 8, '+ ' + (nRows - 12) + ' itens não listados.', { size: 6.5, anchor: 'start', fill: P.mut });
  }
}

function pdfPhotoPage(doc, ctx, room, ph, idx, total) {
  const G = pdfFrame(doc, ctx, 'Foto ' + (idx + 1) + ' · ' + room.name, ph.title || 'Foto com medidas', ctx.pg(), total);
  const P = PAL_PRINT;
  const maxW = PW - 2 * PM - 200, maxH = PH - 2 * PM - 52;
  let W = maxW, H = W * ph.h / ph.w;
  if (H > maxH) { H = maxH; W = H * ph.w / ph.h; }
  const x0 = PM, y0 = PM + 40;
  const c = { G, v: new View(1, 0, 0), K: W / 560, P, hit: false };
  drawPhoto(c, ph, x0, y0, W, null);
  const sx = PM + maxW + 14;
  G.text(sx, y0 + 4, 'MEDIDAS NA FOTO', { size: 7, bold: true, anchor: 'start', fill: P.accent });
  ph.ann.forEach((a, k) => {
    const yy = y0 + 20 + k * 13;
    G.rect(sx, yy - 4, 8, 8, { fill: a.color || '#F2C200', stroke: '#000000', w: 0.5 });
    G.text(sx + 13, yy, (a.lbl ? a.lbl + ' · ' : '') + fmt(a.mm, ctx.unit, true) + (a.src === 'laser' ? '  v' : ''), { size: 7.4, anchor: 'start', fill: P.ink });
  });
}

/* Gera o PDF inteiro. photoBytes: {id:{bytes,w,h}} */
function buildPdf(state, photoBytes) {
  const doc = new PdfDoc();
  for (const id in (photoBytes || {})) doc.addImage(id, photoBytes[id].bytes, photoBytes[id].w, photoBytes[id].h);
  const saved = UNIT;
  setUnit(state.unit);
  const pages = [];
  state.rooms.forEach((r, ri) => {
    if (hasWalls(r)) {
      pages.push(['plan', ri]);
      if (r.ceil.length) pages.push(['ceil', ri]);
      wallOrder(r).forEach(wi => pages.push(['wall', ri, wi]));
    }
    (r.photos || []).forEach((p, k) => pages.push(['photo', ri, k]));
  });
  let n = 0;
  const ctx = { meta: state.meta, unit: state.unit, pg: () => ++n };
  const total = pages.length;
  for (const p of pages) {
    const r = state.rooms[p[1]];
    if (p[0] === 'plan') pdfPlanPage(doc, ctx, r, p[1], total);
    else if (p[0] === 'ceil') pdfCeilPage(doc, ctx, r, total);
    else if (p[0] === 'wall') pdfWallPage(doc, ctx, r, p[2], total);
    else pdfPhotoPage(doc, ctx, r, r.photos[p[2]], p[2], total);
  }
  setUnit(saved);
  return doc.build('Conferência de medidas · ' + (state.meta.nome || 'Cliente'));
}
