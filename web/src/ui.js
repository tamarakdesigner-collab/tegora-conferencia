/* ===== Tégora · interface ===== */
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const eh = esc;
const LS = 'tegora:v1';
const ANN_COLORS = ['#F2C200', '#FF3B30', '#34C759', '#0A84FF', '#FFFFFF', '#111111', '#FF9500', '#BF5AF2'];
const CEIL_HINT = 'Arraste no desenho para criar um rebaixo.';

let S = null;
const PHOTOS = {};
let UI = { strokes: [], stroke: null, selCorner: null, view: 'client', selDrain: null, newClient: false, tab: 'plan', sel: null, selCeil: null, selPhoto: null, selAnn: null, tool: null, uv: null, annColor: '#F2C200', addRoom: false, draft: null, libCat: 'esq', confirm: null, curV: { s: 1, ox: 0, oy: 0 }, vkey: '' };
let undoStack = [];
let toastT = null, fid = 0;

const CL = () => S.clients[S.cc];
const R = () => CL().rooms[S.cur];
const inv = mm => { const u = UNITS[UNIT]; return String(+(mm / u.f).toFixed(u.dec)).replace('.', ','); };
const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); };
const srcBadge = s => s === 'laser' ? '<span class="badge laser">trena ✓</span>' : '<span class="badge">manual</span>';

/* ---------- persistência ---------- */
function persist() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
}
function persistPhoto(id) {
  try { localStorage.setItem('tegora:ph:' + id, JSON.stringify(PHOTOS[id])); } catch (e) { toast('Sem espaço para guardar esta foto neste navegador. Exporte o projeto (JSON) para não perdê-la.'); }
}
function loadLocal() {
  try {
    const s = localStorage.getItem(LS);
    if (!s) return null;
    const o = migrateState(JSON.parse(s));
    if (!o) return null;
    for (const c of o.clients) for (const r of c.rooms) for (const p of (r.photos || [])) {
      try { const x = localStorage.getItem('tegora:ph:' + p.id); if (x) PHOTOS[p.id] = JSON.parse(x); } catch (e) { }
    }
    return o;
  } catch (e) { return null; }
}
function pushUndo(snap) { undoStack.push(snap || JSON.stringify(S)); if (undoStack.length > 40) undoStack.shift(); }
function tryMut(fn, o) {
  const snap = JSON.stringify(S);
  let r;
  try { r = fn(); } catch (e) { r = { ok: false, msg: 'Não foi possível aplicar essa alteração.' }; }
  if (r && r.ok === false) { S = JSON.parse(snap); toast(r.msg || 'Alteração não aplicada.'); renderAll(); return false; }
  pushUndo(snap); persist(); (o && o.stage) ? renderStage() : renderAll();
  return true;
}
function doUndo() {
  if (!undoStack.length) return;
  S = JSON.parse(undoStack.pop());
  UI.sel = null; UI.selCeil = null; UI.selAnn = null; persist(); renderAll();
}

/* ---------- campos ---------- */
function fld(label, mm, act, data, o) {
  o = o || {};
  const id = 'f' + (++fid);
  const da = Object.entries(data || {}).map(([k, v]) => ` data-${k}="${eh(v)}"`).join('');
  const val = o.txt ? eh(mm) : inv(mm);
  return `<label class="fld"><span>${label}${o.badge ? ' ' + o.badge : ''}</span><div class="in"><input id="${id}" ${o.txt ? 'type="text" class="txt"' : 'type="text" inputmode="decimal" autocomplete="off"'} value="${val}" data-act="${act}"${da}>${o.meas ? `<button type="button" class="meas" data-act="meas" data-t="${id}" title="Leitura simulada da trena GLM 50 C">Medir</button>` : ''}</div></label>`;
}
function sel(label, act, opts, cur, data) {
  const da = Object.entries(data || {}).map(([k, v]) => ` data-${k}="${eh(v)}"`).join('');
  return `<label class="fld"><span>${label}</span><div class="in"><select data-act="${act}"${da}>${opts.map(([v, t]) => `<option value="${eh(v)}"${String(v) === String(cur) ? ' selected' : ''}>${eh(t)}</option>`).join('')}</select></div></label>`;
}
function simRead(cur) {
  if (cur > 0) return Math.max(1, Math.round(cur + (Math.random() * 12 - 6)));
  return Math.round(400 + Math.random() * 3600);
}

/* ---------- vistas ---------- */
function fitKey() {
  return [UI.tab === 'export' ? 'plan' : UI.tab, S.cc, S.cur, UI.tab === 'walls' ? S.wall : '', UI.tab === 'photos' ? UI.selPhoto : ''].join('|');
}
function stageRect() { const r = $('#stage').getBoundingClientRect(); return { w: Math.max(100, r.width), h: Math.max(100, r.height) }; }
function viewFor(rect, K) {
  const room = R(), key = fitKey();
  UI.vkey = key;
  if (UI.uv && UI.uv.key === key) return new View(UI.uv.s, UI.uv.ox, UI.uv.oy);
  if (UI.tab === 'walls') {
    const L = wallLen(room, S.wall);
    return View.fit({ x0: 0, y0: 0, x1: L, y1: room.H + wallTopExtra(room) }, { x: 52 * K, y: 84 * K, w: rect.w - 100 * K, h: rect.h - 112 * K }, 0);
  }
  if (UI.tab === 'photos') {
    const ph = room.photos.find(p => p.id === UI.selPhoto);
    if (ph) return View.fit({ x0: 0, y0: 0, x1: ph.w, y1: ph.h }, { x: 0, y: 0, w: rect.w, h: rect.h }, 6);
  }
  if (!hasWalls(room)) return View.fit({ x0: 0, y0: 0, x1: 10000, y1: 7000 }, { x: 0, y: 0, w: rect.w, h: rect.h }, 24 * K);
  return View.fit(bbox(R().pts), { x: 0, y: 0, w: rect.w, h: rect.h }, 70 * K);
}

function renderStage() {
  const st = $('#stage');
  if (!st || S.cc == null || UI.view !== 'work') return;
  const rc = stageRect(), K = rc.w < 600 ? 1.2 : 1;
  const G = new SvgG(rc.w, rc.h);
  const room = R();
  const v = viewFor(rc, K);
  UI.curV = { s: v.s, ox: v.ox, oy: v.oy };
  const c = { G, v, K, P: PAL_SCREEN, hit: true };
  let hint = '';
  if (UI.tab === 'plan' || UI.tab === 'export') {
    if (!hasWalls(room)) {
      if (UI.tab === 'plan') {
        for (let gx = 0; gx <= 10000; gx += 1000) G.line(v.X(gx), v.Y(0), v.X(gx), v.Y(7000), { stroke: PAL_SCREEN.mut, w: 0.4, op: 0.35 });
        for (let gy = 0; gy <= 7000; gy += 1000) G.line(v.X(0), v.Y(gy), v.X(10000), v.Y(gy), { stroke: PAL_SCREEN.mut, w: 0.4, op: 0.35 });
        const all = UI.strokes.concat(UI.stroke ? [UI.stroke] : []);
        all.forEach(st => { if (st.length > 1) G.poly(st.map(p => [v.X(p[0]), v.Y(p[1])]), { fill: 'none', stroke: PAL_SCREEN.sel, w: 3, close: false }); });
        if (!all.length) G.text(rc.w / 2, rc.h / 2, 'Desenhe o contorno do ambiente com o dedo', { size: 13, fill: PAL_SCREEN.mut });
        hint = 'Contorne o ambiente de canto em canto · as paredes se ajustam ao concluir';
      }
    } else {
      drawPlan(c, room, { selWall: UI.tab === 'plan' ? S.wall : null, selDrain: UI.tab === 'plan' ? UI.selDrain : null, corners: UI.tab === 'plan', selCorner: UI.selCorner });
      hint = UI.tab === 'plan' ? 'Toque numa parede, canto ou ralo · arraste os pontos dos cantos para reposicionar · pinça para zoom' : '';
    }
  } else if (UI.tab === 'walls') {
    drawWall(c, room, S.wall, { sel: UI.sel });
    hint = 'Toque num item e arraste para posicioná-lo · pinça para zoom';
  } else if (UI.tab === 'ceil') {
    drawCeil(c, room, { selCeil: UI.selCeil, hitCeil: true });
    if (UI.draft) {
      const d = UI.draft, x0 = Math.min(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), x1 = Math.max(d.a[0], d.b[0]), y1 = Math.max(d.a[1], d.b[1]);
      G.rect(v.X(x0), v.Y(y1), (x1 - x0) * v.s, (y1 - y0) * v.s, { fill: 'none', stroke: PAL_SCREEN.sel, w: 2, dash: [6, 4] });
      G.text(v.X((x0 + x1) / 2), v.Y((y0 + y1) / 2), fmt(x1 - x0) + ' × ' + fmt(y1 - y0), { size: 11, font: 'mono', bold: true, fill: PAL_SCREEN.sel });
    }
    const fs = UI.cstroke;
    if (fs && fs.length > 1) G.poly(fs.map(p => [v.X(p[0]), v.Y(p[1])]), { fill: 'none', stroke: PAL_SCREEN.sel, w: 3, close: false });
    hint = UI.tool === 'draw' ? CEIL_HINT : UI.tool === 'free' ? 'Contorne a área da ' + UI.freeKind + ' com o dedo, dentro do ambiente · o contorno é ajustado em esquadro' : 'Toque num rebaixo para editar · arraste para mover';
  } else if (UI.tab === 'photos') {
    const ph = room.photos.find(p => p.id === UI.selPhoto);
    if (ph) {
      const W = ph.w * v.s;
      drawPhoto({ G, v, K: 1.1, P: PAL_SCREEN, hit: true }, ph, v.ox, v.oy - ph.h * v.s, W, UI.selAnn);
      hint = UI.tool ? 'Arraste sobre a foto para criar a ' + (UI.tool === 'cota' ? 'cota' : 'seta') : 'Toque numa cota para editar';
    } else {
      G.text(rc.w / 2, rc.h / 2, 'Adicione uma foto para marcar medidas', { size: 13, fill: PAL_SCREEN.mut });
    }
  }
  st.querySelector('#cv').innerHTML = G.toString('style="display:block"');
  $('#hint').textContent = hint;
  $('#hint').hidden = !hint;
}

/* ---------- painéis ---------- */
function wallChips() {
  const room = R();
  return `<div class="wchips">${wallOrder(room).map(i => `<button class="wchip" data-act="wall" data-i="${i}" aria-pressed="${i === S.wall}" title="Parede ${wnum(room, i)}">${wnum(room, i)}</button>`).join('')}</div>`;
}
function summaryHtml(room) {
  const s = roomSummary(room);
  const m2 = x => (x / 1e6).toFixed(2).replace('.', ',') + ' m²';
  return `<div class="kv"><span>Área do piso</span><b>${m2(s.area)}</b><span>Perímetro</span><b>${fmt(s.per, UNIT, true)}</b><span>Parede bruta</span><b>${m2(s.gross)}</b><span>Parede líquida</span><b>${m2(s.net)}</b><span>Volume</span><b>${(s.vol / 1e9).toFixed(2).replace('.', ',')} m³</b></div>`;
}

function emptyNotice() {
  return `<h2>${eh(R().name)}</h2><div class="card"><p style="margin:0 0 10px">Primeiro desenhe o contorno do ambiente na aba Planta.</p><button class="btn sm" data-act="tab" data-v="plan">Ir para a Planta</button></div>`;
}
function panelEmpty() {
  const room = R();
  let h = `<h2>${eh(room.name)}</h2>`;
  h += `<div class="card"><div class="row">${fld('Nome do ambiente', room.name, 'roomName', {}, { txt: true })}${fld('Pé-direito', room.H, 'roomH', {}, { meas: true, badge: srcBadge(room.Hsrc) })}</div><div class="row" style="margin-top:8px">${fld('Espessura das paredes', room.tw || 120, 'roomTw', {}, { meas: true })}</div><p class="muted small" style="margin:4px 0 0">A medida da trena é a face interna. O DXF leva também a face externa, deslocada por esta espessura.</p></div>`;
  h += `<h3>Desenhe o contorno</h3><div class="card"><p style="margin:0 0 8px">Com o dedo (ou o mouse), contorne o ambiente na área acima, de canto em canto, na ordem em que vai medir. O primeiro trecho é a <b>parede 1</b>, o segundo a parede 2, e assim por diante.</p><p class="muted small" style="margin:0 0 10px">Ao fechar o contorno, as paredes se ajustam sozinhas (retas e em esquadro). Depois é só informar as medidas reais de cada parede.</p>`;
  h += `<div class="row"><button class="btn" data-act="traceDone"${UI.strokes.length ? '' : ' disabled'}>Concluir contorno</button><button class="btn sec" data-act="traceClear"${UI.strokes.length ? '' : ' disabled'}>Apagar traço</button></div></div>`;
  h += `<details><summary>Prefere informar as medidas? (ambiente retangular)</summary><div class="card" data-form="rect"><div class="row">${fld('Largura', 3000, 'noop', { f: 'w' }, { meas: true })}${fld('Profundidade', 3000, 'noop', { f: 'l' }, { meas: true })}<button class="btn sec sm" data-act="rectRoom">Criar</button></div></div></details>`;
  return h;
}
function panelPlan() {
  if (!hasWalls(R())) return panelEmpty();
  const room = R(), i = S.wall, g = wallGeom(room, i);
  const lab = labelsFor(room);
  const ops = room.items.filter(x => x.kind === 'op').sort((a, b) => (a.wall - b.wall) || (a.u - b.u));
  let h = '';
  h += `<h3>Parede</h3><div class="card">${wallChips()}<div class="row" style="margin-top:10px">${fld('Comprimento da parede ' + wnum(room, i), g.L, 'wallLen', { i }, { meas: true, badge: srcBadge(wallSrc(room, i)) })}<button class="btn sec" data-act="goWall" data-i="${i}">Ver parede →</button></div>`;
  h += `<details><summary>Espessura só desta parede</summary><div class="row">${fld('Espessura da parede ' + wnum(room, i), wallT(room, i), 'wallT', { i }, { meas: true })}</div></details>`;
  h += `<details><summary>Pilar ou recuo nesta parede</summary><div class="row" data-form="notch">${sel('Tipo', 'noop', [['pilar', 'Pilar (avança)'], ['recuo', 'Recuo (entra)']], 'pilar', { f: 'type' })}${fld('Início (da esq.)', 500, 'noop', { f: 'u0' }, { meas: true })}${fld('Largura', 400, 'noop', { f: 'w' }, { meas: true })}${fld('Profundidade', 200, 'noop', { f: 'd' }, { meas: true })}<button class="btn sec sm" data-act="notch">Aplicar</button></div></details></div>`;
  h += `<h2>${eh(room.name)}</h2><p class="muted small" style="margin:0 0 10px">Planta baixa com medidas gerais, esquadrias e pé-direito. Alterar uma parede reajusta as vizinhas e os itens, mantendo as proporções.</p>`;
  h += `<div class="card"><div class="row">${fld('Nome do ambiente', room.name, 'roomName', {}, { txt: true })}${fld('Pé-direito', room.H, 'roomH', {}, { meas: true, badge: srcBadge(room.Hsrc) })}</div></div>`;
  if (UI.selCorner != null && UI.selCorner < room.pts.length) {
    const n = room.pts.length, k = UI.selCorner;
    h += `<div class="card"><b>Canto ${k + 1}</b> · encontro das paredes ${wnum(room, (k + n - 1) % n)} e ${wnum(room, k)}<p class="muted small" style="margin:4px 0 0">Arraste o ponto na planta para reposicionar. As paredes vizinhas acompanham e continuam em esquadro.</p></div>`;
  }
  h += `<h3>Resumo</h3><div class="card">${summaryHtml(room)}</div>`;
  h += `<h3>Esquadrias</h3>`;
  h += ops.length ? `<div class="list">${ops.map(o => `<button data-act="goItem" data-id="${o.id}" data-i="${o.wall}"><span><b>${lab.tags[o.id]}</b> ${eh(o.name)} · parede ${wnum(room, o.wall)}</span><span class="m">${fmt(o.w)} × ${fmt(o.h)}</span></button>`).join('')}</div>` : '<p class="muted small">Nenhuma esquadria. Adicione na aba Paredes.</p>';
  h += `<h3>Ralos</h3><div class="row"><button class="btn sec sm" data-act="drAdd">+ Ralo na planta</button></div>`;
  if (room.drains.length) h += `<div class="list" style="margin-top:8px">${room.drains.map((d, k) => `<button data-act="drSel" data-id="${d.id}" aria-pressed="${d.id === UI.selDrain}"><span><b>RL${k + 1}</b> Ralo ø${fmt(d.d)}</span><span class="m">${fmt(d.x - bbox(room.pts).x0)} · ${fmt(d.y - bbox(room.pts).y0)}</span></button>`).join('')}</div>`;
  const dr = room.drains.find(d => d.id === UI.selDrain);
  if (dr) {
    const ry = drainRays(room, [dr.x, dr.y]), dd = { id: dr.id };
    const f4 = (lab, v, act) => isFinite(v) ? fld(lab, v, act, dd, { meas: true }) : '';
    h += `<div class="card" style="margin-top:8px"><div class="row">${fld('Diâmetro', dr.d, 'drDia', dd, {})}</div><div class="row" style="margin-top:8px">${f4('Da parede esquerda', dr.x - ry.xl, 'drXl')}${f4('Da parede direita', ry.xr - dr.x, 'drXr')}</div><div class="row" style="margin-top:8px">${f4('Da parede inferior', dr.y - ry.yb, 'drYb')}${f4('Da parede superior', ry.yt - dr.y, 'drYt')}</div><div class="row" style="margin-top:10px"><button class="btn dng sm" data-act="drDel">Excluir ralo</button></div></div>`;
  }
  h += `<div class="row" style="margin-top:14px"><button class="btn dng sm" data-act="redraw">${UI.confirm === 'redraw' ? 'Confirmar? apaga paredes e itens' : 'Redesenhar contorno'}</button></div>`;
  h += `<h3>Observações da medição</h3><div class="card"><label class="fld"><span>Anotações deste ambiente (saem no PDF)</span><textarea data-act="roomObs" rows="4" class="txt">${eh(room.obs || '')}</textarea></label></div>`;
  return h;
}

function itemEditor(it, room) {
  const g = wallGeom(room, it.wall), t = LIBMAP[it.type];
  const left = it.u, right = g.L - (it.kind === 'op' ? it.u + it.w : it.u);
  const d = { id: it.id };
  let h = `<h3>${eh(it.name)} ${srcBadge(it.src)}</h3><div class="card"><div class="row">`;
  h += fld(it.type === 'coringa' ? 'Nome do ponto coringa' : 'Nome', it.name, 'itName', d, { txt: true });
  h += '</div><div class="row" style="margin-top:8px">';
  h += fld('Largura', it.w, 'itW', d, { meas: true }) + fld('Altura', it.h, 'itH', d, { meas: true });
  h += '</div><div class="row" style="margin-top:8px">';
  h += fld(it.kind === 'op' ? 'Dist. da esquerda' : 'Centro à esquerda', left, 'itUL', d, { meas: true }) + fld(it.kind === 'op' ? 'Dist. da direita' : 'Centro à direita', right, 'itUR', d, { meas: true });
  h += '</div><div class="row" style="margin-top:8px">';
  h += fld(it.kind === 'op' ? 'Peitoril (do piso)' : it.zb ? 'Altura da base ao piso' : 'Altura do centro', it.z, 'itZ', d, { meas: true });
  if (it.kind === 'op') h += fld('Sobre a abertura', room.H - it.z - it.h, 'itTop', d, { meas: true });
  h += '</div>';
  if (it.type === 'porta-giro') h += `<div class="row" style="margin-top:8px">${sel('Dobradiça', 'itHinge', [['L', 'Esquerda'], ['R', 'Direita']], it.hinge || 'L', d)}${sel('Abre para', 'itSwing', [['in', 'Dentro'], ['out', 'Fora']], it.swing || 'in', d)}</div>`;
  if (it.type === 'porta-giro2') h += `<div class="row" style="margin-top:8px">${sel('Abre para', 'itSwing', [['in', 'Dentro'], ['out', 'Fora']], it.swing || 'in', d)}</div>`;
  if (it.type === 'coringa') h += `<div class="row" style="margin-top:8px">${sel('Forma', 'itShape', [['rect', 'Retângulo'], ['circle', 'Círculo']], it.shape || 'rect', d)}</div>`;
  h += `<div class="row" style="margin-top:10px"><button class="btn sec sm" data-act="itDup">Duplicar</button><button class="btn dng sm" data-act="itDel">Excluir</button></div></div>`;
  return h;
}

function panelWalls() {
  if (!hasWalls(R())) return emptyNotice();
  const room = R(), i = S.wall, g = wallGeom(room, i);
  const lab = labelsFor(room);
  const items = itemsOn(room, i);
  let h = `<h2>Parede ${wnum(room, i)}</h2><p class="muted small" style="margin:0 0 8px">${fmt(g.L, UNIT, true)} de comprimento · pé-direito ${fmt(room.H, UNIT, true)}. Vista frontal, como quem olha a parede por dentro do ambiente.</p>${wallChips()}`;
  h += `<h3>Biblioteca</h3><div class="cats">${CATS.map(c => `<button class="chip" data-act="libCat" data-v="${c.id}" aria-pressed="${UI.libCat === c.id}">${c.short}</button>`).join('')}</div>`;
  h += `<div class="lib">${LIB.filter(t => t.cat === UI.libCat && !t.hidden).map(t => `<button data-act="libAdd" data-t="${t.id}"><span class="gl ${t.cat}">${t.code || t.tag}</span><span>${eh(t.name)}</span></button>`).join('')}</div>`;
  const it = room.items.find(x => x.id === UI.sel && x.wall === i);
  if (it) h += itemEditor(it, room);
  h += `<h3>Nesta parede</h3>`;
  h += items.length ? `<div class="list">${items.map(x => `<button data-act="sel" data-id="${x.id}" aria-pressed="${x.id === UI.sel}"><span><b>${x.kind === 'op' ? lab.tags[x.id] : lab.nums[x.id]}</b> ${eh(x.name)}</span><span class="m">${fmt(x.u)}${x.kind === 'op' ? '' : ' · z ' + fmt(x.z)}</span></button>`).join('')}</div>` : '<p class="muted small">Nada lançado ainda. Toque num símbolo da biblioteca para inseri-lo.</p>';
  return h;
}

function ceilEditor(el, room) {
  const b = bbox(room.pts), d = { id: el.id };
  const base = ceilBase(room, el), nE = base.length;
  let h = `<h3>${eh(el.name)}</h3><div class="card"><div class="row">${fld('Nome', el.name, 'cName', d, { txt: true })}</div><div class="row" style="margin-top:8px">`;
  h += fld(el.sanca ? 'Profundidade da sanca' : 'Rebaixo (da laje)', el.drop, 'cDrop', d, { meas: true });
  h += sel('Acabamento', 'cTrim', [['none', 'Sem acabamento'], ['roda', 'Rodaforro'], ['neg', 'Negativo']], el.trim, d);
  h += '</div>';
  if (el.trim === 'roda') h += `<div class="row" style="margin-top:8px">${fld('Rodaforro: espessura', el.tw, 'cTw', d, { meas: true })}${fld('Rodaforro: altura', el.th, 'cTh', d, { meas: true })}</div>`;
  if (el.trim === 'neg') h += `<div class="row" style="margin-top:8px">${fld('Negativo: espessura', el.tw, 'cTw', d, { meas: true })}${fld('Pé-direito do negativo', negH(room, el), 'cNh', d, { meas: true })}</div><p class="muted small" style="margin:4px 0 0">O negativo sobe acima do forro até este pé-direito (maior que o normal, ${fmt(room.H, UNIT, true)}).</p>`;
  if (el.kind === 'rect') {
    h += `<div class="row" style="margin-top:8px">${fld('A partir da parede esq.', el.x - b.x0, 'cX', d, { meas: true })}${fld('A partir da parede inferior', el.y - b.y0, 'cY', d, { meas: true })}</div>`;
    h += `<div class="row" style="margin-top:8px">${fld('Largura', el.w, 'cW', d, { meas: true })}${fld('Profundidade', el.h, 'cH', d, { meas: true })}</div>`;
  }
  const eo = el.eo || [];
  h += `<details${eo.some(q => q) ? ' open' : ''}><summary>Editar arestas (simular sanca)</summary><p class="muted small" style="margin:2px 0 8px">Recue cada aresta do forro para dentro. O vão entre a parede e o forro forma a sanca. Os números aparecem na planta quando o forro está selecionado.</p><div class="row">`;
  for (let k = 0; k < nE; k++) h += fld('Aresta ' + (el.kind === 'room' ? 'da parede ' + wnum(room, k) : k + 1), eo[k] || 0, 'cEo', Object.assign({ k }, d), { meas: true });
  h += `</div><div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="cEoReset" data-id="${el.id}">Zerar arestas</button></div></details>`;
  h += `<p class="muted small" style="margin:8px 0 0">Altura do forro: ${fmt(room.H - el.drop, UNIT, true)}</p>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn dng sm" data-act="cDel">Excluir</button></div></div>`;
  return h;
}
function panelCeil() {
  if (!hasWalls(R())) return emptyNotice();
  const room = R();
  const hasRoom = room.ceil.some(e => e.kind === 'room');
  let h = `<h2>Forro de gesso</h2><p class="muted small" style="margin:0 0 8px">O forro pode ser gerado automaticamente no formato da planta e editado depois: rodaforro, negativo, arestas recuadas (sanca) e rebaixos desenhados à mão livre.</p>`;
  if (!hasRoom) h += `<div class="row" style="margin-bottom:8px"><button class="btn" data-act="cNewRoom">Gerar forro automático (padrão da planta)</button></div>`;
  h += `<div class="row"><button class="btn sm ${UI.tool === 'free' && UI.freeKind === 'rebaixo' ? '' : 'sec'}" data-act="cFree" data-v="rebaixo">${UI.tool === 'free' && UI.freeKind === 'rebaixo' ? '✓ Desenhando rebaixo…' : 'Rebaixo à mão livre'}</button><button class="btn sm ${UI.tool === 'free' && UI.freeKind === 'sanca' ? '' : 'sec'}" data-act="cFree" data-v="sanca">${UI.tool === 'free' && UI.freeKind === 'sanca' ? '✓ Desenhando sanca…' : 'Sanca à mão livre'}</button></div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="cDraw">${UI.tool === 'draw' ? '✓ Desenhando — toque para sair' : 'Rebaixo retangular'}</button><button class="btn sec sm" data-act="cNewRect">+ Rebaixo por medidas</button></div>`;
  h += `<h3>Elementos</h3>`;
  h += room.ceil.length ? `<div class="list">${room.ceil.map(e => `<button data-act="cSel" data-id="${e.id}" aria-pressed="${e.id === UI.selCeil}"><span>${eh(e.name)}</span><span class="m">${e.sanca ? 'sanca ' + fmt(e.drop) : e.drop ? 'rebaixo ' + fmt(e.drop) : 'rente à laje'}</span></button>`).join('')}</div>` : '<p class="muted small">Nenhum elemento de forro ainda.</p>';
  const el = room.ceil.find(e => e.id === UI.selCeil);
  if (el) h += ceilEditor(el, room);
  return h;
}

function panelPhotos() {
  const room = R();
  const ph = room.photos.find(p => p.id === UI.selPhoto);
  let h = `<h2>Fotos com medidas</h2><p class="muted small" style="margin:0 0 8px">Insira fotos do local e marque medidas com linha de cota ou seta. Elas saem no PDF ao lado da planta.</p>`;
  h += `<div class="row"><label class="btn sm" style="display:inline-block">📷 Tirar foto<input type="file" accept="image/*" capture="environment" data-act="phFile" hidden></label><label class="btn sec sm" style="display:inline-block">Escolher da galeria<input type="file" accept="image/*" multiple data-act="phFile" hidden></label></div><p class="muted small" style="margin:6px 0 0">“Tirar foto” abre a câmera do aparelho. A foto entra direto para você marcar as medidas.</p>`;
  if (room.photos.length) h += `<div class="thumbs" style="margin-top:10px">${room.photos.map(p => `<button data-act="phSel" data-id="${p.id}" aria-pressed="${p.id === UI.selPhoto}" style="background-image:url('${PHOTOS[p.id] ? PHOTOS[p.id].url : ''}')" title="${eh(p.title || 'Foto')}"></button>`).join('')}</div>`;
  if (ph) {
    h += `<h3>Marcar medidas</h3><div class="row"><button class="btn ${UI.tool === 'cota' ? '' : 'sec'} sm" data-act="tool" data-v="cota">Linha de cota</button><button class="btn ${UI.tool === 'seta' ? '' : 'sec'} sm" data-act="tool" data-v="seta">Seta</button></div>`;
    h += `<h3>Cor das linhas e medidas</h3><div class="sw">${ANN_COLORS.map(c => `<button data-act="annColor" data-v="${c}" aria-pressed="${(UI.selAnn ? (ph.ann.find(a => a.id === UI.selAnn) || {}).color : UI.annColor) === c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div>`;
    const an = ph.ann.find(a => a.id === UI.selAnn);
    if (an) {
      const d = { id: an.id };
      h += `<h3>${an.kind === 'arrow' ? 'Seta' : 'Cota'} selecionada ${srcBadge(an.src)}</h3><div class="card"><div class="row">${an.kind === 'arrow' ? '' : fld('Medida', an.mm || 0, 'anMm', d, { meas: true })}${fld('Texto (opcional)', an.lbl || '', 'anLbl', d, { txt: true })}</div><div class="row" style="margin-top:10px"><button class="btn dng sm" data-act="anDel">Excluir marcação</button></div></div>`;
    }
    h += `<h3>Foto</h3><div class="card"><div class="row">${fld('Legenda', ph.title || '', 'phTitle', {}, { txt: true })}</div><div class="row" style="margin-top:10px"><button class="btn dng sm" data-act="phDel">${UI.confirm === 'phDel' ? 'Confirmar exclusão?' : 'Excluir foto'}</button></div></div>`;
  }
  return h;
}

function pagesOf(rooms) { return rooms.reduce((n, r) => n + (hasWalls(r) ? 1 + (r.ceil.length ? 1 : 0) + r.pts.length : 0) + r.photos.length, 0); }
function panelExport() {
  const c = CL(), room = R();
  let h = `<h2>Exportar</h2><p class="muted small" style="margin:0 0 8px">Cliente: <b>${eh(c.nome || '—')}</b>. Os dados do cliente ficam na tela do cliente.</p>`;
  h += `<h3>PDF cotado</h3><div class="card"><p class="small" style="margin:0 0 10px">Planta, forro, uma vista por parede (com as cotas dos pontos nas cores de cada categoria), fotos e observações, com a marca Tégora.</p><div class="row"><button class="btn" data-act="expPdf" data-v="room">Só ${eh(room.name)} (${pagesOf([room])} pág.)</button><button class="btn sec" data-act="expPdf" data-v="all">Cliente inteiro (${pagesOf(c.rooms)} pág.)</button></div></div>`;
  h += `<h3>DXF da planta (Promob)</h3><div class="card"><p class="small" style="margin:0 0 10px">Somente a <b>planta baixa</b>, um arquivo .dxf por ambiente (AutoCAD R12, em mm, CRLF) com as duas faces da parede (interna e externa, pela espessura informada), esquadrias e ralos, só com LINE, ARC e CIRCLE: sem textos, cotas, blocos, polilinhas nem hachuras. Vai dentro de um .zip.</p><div class="row"><button class="btn" data-act="expDxf" data-v="room">Só ${eh(room.name)}</button><button class="btn sec" data-act="expDxf" data-v="all">Todos os ambientes</button></div></div>`;
  h += `<h3>Trena Bluetooth (GLM 50 C)</h3><div class="card"><div id="btdiag">${btDiagHtml()}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="conectar">${BT.state === 'on' ? 'Desconectar' : 'Conectar trena'}</button><button class="btn sec sm" data-act="conectarTodos">Listar todos os dispositivos</button><button class="btn sec sm" data-act="conectarSerial">Bluetooth clássico (PC)</button><button class="btn sec sm" data-act="conectarSerialTodas">Clássico: listar todas as portas</button></div><div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="btSync">Reenviar sincronização</button><button class="btn sec sm" data-act="btStart">Disparar medição</button><button class="btn sec sm" data-act="btLaser">Disparar laser</button><button class="btn sec sm" data-act="btCopy">Copiar registro</button></div><p class="muted small" style="margin:8px 0 0">Ligue o Bluetooth da trena (tecla de Bluetooth). Com ela conectada, toque em “Medir” ao lado do campo e meça: o valor entra no campo.</p></div>`;
  h += `<h3>Backup</h3><div class="card"><p class="small" style="margin:0 0 10px">Cópia de segurança de todos os clientes, para reabrir depois ou em outro aparelho.</p><div class="row"><button class="btn sec" data-act="expJson">Salvar backup</button><label class="btn sec" style="display:inline-block">Abrir backup<input type="file" accept=".json,application/json" data-act="impJson" hidden></label></div></div>`;
  return h;
}

function roomForm() {
  return `<div class="card" data-form="room"><h3 style="margin-top:0">Novo ambiente</h3><div class="row">${fld('Nome', 'Ambiente ' + (CL().rooms.length + 1), 'noop', { f: 'name' }, { txt: true })}${fld('Pé-direito', R().H, 'noop', { f: 'h' }, { meas: true })}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="roomNew">Criar</button><button class="btn sec sm" data-act="roomAdd">Cancelar</button></div><p class="muted small" style="margin:8px 0 0">O ambiente nasce vazio: você desenha o contorno na planta.</p></div>`;
}

function renderPanel() {
  const p = $('#panel');
  const keep = p.scrollTop;
  let h = UI.addRoom ? roomForm() : '';
  h += ({ plan: panelPlan, walls: panelWalls, ceil: panelCeil, photos: panelPhotos, export: panelExport })[UI.tab]();
  p.innerHTML = '<div class="gut">' + h + '</div>';
  p.scrollTop = keep;
  if (BT.armed) { const b = document.querySelector('.meas[data-t="' + BT.armed + '"]'); if (b) b.classList.add('armed'); }
}
function renderHead() {
  const work = UI.view === 'work' && S.cc != null, home = S.cc == null;
  $('#units').innerHTML = ['mm', 'cm', 'm'].map(u => `<button data-act="unit" data-v="${u}" aria-pressed="${UNIT === u}">${u}</button>`).join('');
  $('#undo').disabled = !undoStack.length; $('#undo').hidden = !work;
  $('#back').hidden = home;
  $('#pname').textContent = home ? 'Clientes' : (CL().nome || 'Cliente') + (work ? ' › ' + R().name : '');
  $('#rooms').hidden = !work; document.querySelector('.tabs').hidden = !work; document.querySelector('main').hidden = !work; document.querySelector('footer').hidden = !work; document.body.classList.toggle('work', !!work);
  $('#home').hidden = work;
  if (work) $('#home').innerHTML = '';
  if (work) {
    $('#rooms').innerHTML = CL().rooms.map((r, i) => `<button class="chip" data-act="room" data-i="${i}" aria-pressed="${i === S.cur}">${eh(r.name)}</button>`).join('') + '<button class="chip add" data-act="roomAdd">+ ambiente</button>';
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.v === UI.tab));
  }
}
/* ---------- trena Bosch GLM por Bluetooth (Web Bluetooth) ---------- */
const GLM_SVC = '02a6c0d0-0451-4000-b000-fb3210111989', GLM_CHR = '02a6c0d1-0451-4000-b000-fb3210111989';
const BT = { dev: null, ch: null, state: 'off', armed: null, last: null, log: [], trace: [], timer: null, err: '' };
const hexOf = dv => Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).map(b => b.toString(16).padStart(2, '0')).join(' ');
const btTrace = m => { BT.trace.push(new Date().toLocaleTimeString('pt-BR') + ' ' + m); if (BT.trace.length > 60) BT.trace.shift(); };
const BT_OPT = [GLM_SVC, 'generic_access', 'device_information', 'battery_service', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb', '6e400001-b5a3-f393-e0a9-e50e24dcca9e', '0000fe59-0000-1000-8000-00805f9b34fb'];
const CMD_SYNC = [0xC0, 0x55, 0x02, 0x01, 0x00, 0x1A], CMD_LASER = [0xC0, 0x56, 0x01, 0x00, 0x1E];
/* pacote de medida: C0 55 10 <flag 06 = válido> ..., distância em metros como float32 little-endian nos bytes 7..10 */
function btParse(dv) {
  if (dv.byteLength < 11 || dv.getUint8(0) !== 0xC0 || dv.getUint8(1) !== 0x55) return null;
  const m = dv.getFloat32(7, true), flag = dv.getUint8(3);
  btTrace('pacote C0 55: flag=' + flag.toString(16) + ' float=' + (isFinite(m) ? m.toFixed(4) : '?'));
  return flag === 0x06 && isFinite(m) && m > 0 && m < 200 ? Math.round(m * 1000) : null;
}
async function btSend(bytes, nome) {
  const cmd = Uint8Array.from(bytes);
  if (BT.nat && NAT()) { NAT().send(Array.from(cmd).map(b => b.toString(16).padStart(2, '0')).join('')); btTrace('enviado ' + nome + ' (app)'); renderBt(); return; }
  if (BT.writer) { try { await BT.writer.write(cmd); btTrace('enviado ' + nome + ' (serial)'); } catch (e) { btTrace('falha ao enviar ' + nome + ': ' + (e.message || e)); } renderBt(); return; }
  if (!BT.ch) { toast('Conecte a trena primeiro.'); return; }
  try { await BT.ch.writeValueWithoutResponse(cmd); btTrace('enviado ' + nome + ' (sem resposta)'); }
  catch (e1) {
    try { await BT.ch.writeValue(cmd); btTrace('enviado ' + nome + ' (com resposta)'); }
    catch (e2) { btTrace('falha ao enviar ' + nome + ': ' + (e2.message || e2)); }
  }
  renderBt();
}
function btFill(id, mm) {
  const input = id && document.getElementById(id);
  if (!input || !document.body.contains(input)) { toast('Leitura ' + fmt(mm, UNIT, true) + '. O campo não está mais na tela: toque em “Medir” de novo.'); return; }
  input.value = inv(mm); input.dataset.src = 'laser';
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function btDisarm() { BT.armed = null; clearTimeout(BT.timer); document.querySelectorAll('.meas.armed').forEach(b => b.classList.remove('armed')); }
function onBtData(e) { btHandle(e.target.value); }
function btHandle(dv) {
  BT.log.unshift(hexOf(dv)); BT.log.length = Math.min(BT.log.length, 8); btTrace('recebido: ' + hexOf(dv));
  const mm = btParse(dv);
  if (mm != null) {
    BT.last = { mm, t: Date.now() };
    if (BT.armed) { const id = BT.armed; btDisarm(); btFill(id, mm); }
    else toast('Leitura da trena: ' + fmt(mm, UNIT, true) + '. Toque em “Medir” ao lado de um campo antes de medir para usá-la.');
  }
  renderBt();
}
function renderBt() {
  const b = $('#bt'); if (!b) return;
  b.dataset.state = BT.state;
  b.textContent = BT.state === 'on' ? 'Trena ●' : BT.state === 'conn' ? 'Conectando…' : 'Trena ○';
  const st = document.querySelector('footer .st');
  if (st) st.innerHTML = '<span class="dot"></span>' + (BT.state === 'on' ? 'Trena conectada' + (BT.last ? ' · última leitura ' + fmt(BT.last.mm, UNIT, true) : '') : 'Trena não conectada · leituras simuladas pelo botão “Medir”');
  const cb = $('#conn'); if (cb) cb.textContent = BT.state === 'on' ? 'Desconectar' : 'Conectar trena';
  const d = $('#btdiag'); if (d) d.innerHTML = btDiagHtml();
}
function btDiagHtml() {
  return `<p class="small" style="margin:0 0 6px">Estado: <b>${BT.state === 'on' ? 'conectada' : BT.state === 'conn' ? 'conectando' : 'desconectada'}</b>${BT.last ? ' · última leitura <b>' + fmt(BT.last.mm, UNIT, true) + '</b>' : ''}${BT.err ? '<br><span style="color:var(--danger,#B3261E)">' + eh(BT.err) + '</span>' : ''}</p>` +
    (BT.trace.length ? `<pre class="btlog">${BT.trace.slice(-25).map(eh).join('\n')}</pre>` : '<p class="muted small" style="margin:0">Sem registro ainda.</p>');
}
async function btConnect(all) {
  if (!navigator.bluetooth) { BT.err = 'Este navegador não oferece Bluetooth para páginas web.'; toast('Sem Bluetooth web aqui. Use o Chrome (Android ou computador); no iPhone não funciona.'); renderBt(); return; }
  BT.state = 'conn'; BT.err = ''; renderBt();
  let stage = 'lista';
  try {
    const opt = all ? { acceptAllDevices: true, optionalServices: BT_OPT } : { filters: [{ services: [GLM_SVC] }, { namePrefix: 'GLM' }, { namePrefix: 'Bosch' }], optionalServices: BT_OPT };
    const dev = await navigator.bluetooth.requestDevice(opt); stage = 'servico';
    dev.addEventListener('gattserverdisconnected', () => { BT.state = 'off'; BT.ch = null; btDisarm(); renderBt(); toast('Trena desconectada.'); });
    btTrace('dispositivo: ' + (dev.name || '(sem nome)'));
    const srv = await dev.gatt.connect(); btTrace('GATT conectado');
    try {
      const all = await srv.getPrimaryServices(); btTrace('servicos visiveis: ' + (all.map(x => x.uuid).join(', ') || 'nenhum'));
      for (const sv of all) { try { const cs = await sv.getCharacteristics(); cs.forEach(c => btTrace('  ' + sv.uuid.slice(0, 8) + ' / ' + c.uuid + ': ' + ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter(k => c.properties[k]).join(',') )); } catch (e) { btTrace('  sem acesso as caracteristicas de ' + sv.uuid.slice(0, 8)); } }
    } catch (e) { btTrace('nao consegui listar servicos: ' + e.message); }
    stage = 'servico';
    const svc = await srv.getPrimaryService(GLM_SVC);
    const ch = await svc.getCharacteristic(GLM_CHR);
    const pr = ch.properties || {}; btTrace('propriedades: ' + ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter(k => pr[k]).join(', '));
    ch.addEventListener('characteristicvaluechanged', onBtData);
    await ch.startNotifications(); btTrace('assinatura ativada');
    BT.dev = dev; BT.ch = ch; BT.state = 'on';
    await btSend(CMD_SYNC, 'sincronizacao C0 55 02 01 00 1A');
    toast('Trena conectada. Toque em “Medir” ao lado de um campo e faça a medição.');
  } catch (e) {
    BT.state = 'off';
    BT.err = e.name === 'NotFoundError' ? (stage === 'lista' ? 'Nenhuma trena foi escolhida na lista (ou a lista veio vazia). Desligue e ligue o Bluetooth da trena e tente de novo; se ela não aparecer, use “Listar todos os dispositivos”.' : 'Conectou, mas a trena não tem o serviço Bluetooth esperado (Bosch 02a6c0d0). Veja o registro abaixo e me envie.') : (e.name === 'SecurityError' || e.name === 'NotAllowedError') ? 'O Bluetooth está bloqueado dentro do Claude. Abra o arquivo index.html direto no Chrome (Android ou computador) para usar a trena.' : (e.name || 'Erro') + ': ' + (e.message || '');
    btTrace('erro: ' + BT.err); toast(BT.err);
  }
  renderBt();
}
/* ---------- aplicativo Android (ponte nativa Bluetooth clássico) ---------- */
const NAT = () => window.TegoraNative || null;
let natBuf = [];
window.__natMsg = m => { btTrace(m); renderBt(); };
window.__natState = (st, m) => {
  if (st === 'on') {
    BT.state = 'on'; BT.nat = true; BT.err = ''; natBuf = []; btTrace('conectado (Bluetooth clássico)'); renderBt();
    toast('Trena conectada. Toque em “Medir” ao lado de um campo e meça.');
    setTimeout(() => btSend(CMD_SYNC, 'sincronizacao C0 55 02 01 00 1A'), 300);
  } else {
    BT.state = 'off'; BT.nat = false; BT.err = m || ''; btTrace('desconectada' + (m ? ': ' + m : '')); btDisarm(); renderBt();
    toast(m ? 'Trena: ' + m : 'Trena desconectada.');
  }
};
window.__natRx = hex => {
  try {
    natBuf.push(...(hex.match(/../g) || []).map(h => parseInt(h, 16)));
    for (;;) {
      const i = natBuf.indexOf(0xC0); if (i < 0) { natBuf = []; break; } if (i > 0) natBuf = natBuf.slice(i);
      if (natBuf.length < 3) break;
      const tot = natBuf[2] + 4;
      if (tot > 64) { natBuf.shift(); continue; }
      if (natBuf.length < tot) break;
      const fr = Uint8Array.from(natBuf.slice(0, tot)); natBuf = natBuf.slice(tot);
      btHandle(new DataView(fr.buffer));
    }
  } catch (e) { btTrace('erro lendo dados: ' + e.message); }
};
function natConnect() {
  const N = NAT(); let r;
  try { r = JSON.parse(N.paired()); } catch (e) { r = { err: 'ponte' }; }
  if (r.err === 'perm') { BT.err = 'Permita “Dispositivos próximos” quando o Android pedir e toque em Conectar de novo.'; btTrace(BT.err); toast(BT.err); renderBt(); return; }
  if (r.err === 'off') { BT.err = 'O Bluetooth do celular está desligado. Ligue e tente de novo.'; btTrace(BT.err); toast(BT.err); renderBt(); return; }
  const list = (r.devices || []).filter(d => /glm|bosch/i.test(d.name || ''));
  if (!list.length) { BT.err = 'Nenhuma trena Bosch pareada. Pareie em Configurações do Android → Bluetooth e tente de novo.'; btTrace(BT.err); toast(BT.err); renderBt(); return; }
  BT.state = 'conn'; BT.err = ''; btTrace('conectando a ' + list[0].name + ' (' + list[0].address + ')'); renderBt();
  N.connect(list[0].address);
}
/* Bluetooth clássico (porta serial SPP) — só Chrome 117+ no computador */
async function serConnect(all) {
  if (!navigator.serial) { BT.err = 'Este navegador não tem Serial por Bluetooth (só Chrome 117 ou mais novo, no computador).'; toast(BT.err); renderBt(); return; }
  const SPP = '00001101-0000-1000-8000-00805f9b34fb';
  BT.state = 'conn'; BT.err = ''; renderBt();
  try {
    let port;
    if (all) port = await navigator.serial.requestPort({});
    else port = await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP], filters: [{ bluetoothServiceClassId: SPP }] });
    try { const inf = port.getInfo && port.getInfo(); btTrace('porta escolhida: ' + JSON.stringify(inf || {})); } catch (e) { }
    let ok = false, lastErr = null;
    for (let t = 1; t <= 8 && !ok; t++) {
      try { await port.open({ baudRate: 9600 }); ok = true; }
      catch (e) {
        lastErr = e; btTrace('tentativa ' + t + '/8 de abrir a porta falhou: ' + (e.message || e.name));
        if (e.name === 'InvalidStateError') { ok = true; break; }
        BT.err = 'Abrindo a porta… tentativa ' + t + '/8 (deixe o visor da trena aceso)'; renderBt();
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!ok) throw lastErr;
    BT.err = ''; btTrace('porta serial aberta');
    BT.port = port; BT.writer = port.writable.getWriter(); BT.state = 'on';
    await btSend(CMD_SYNC, 'sincronizacao C0 55 02 01 00 1A');
    toast('Trena conectada (Bluetooth clássico). Toque em “Medir” ao lado de um campo e meça.');
    renderBt();
    const reader = port.readable.getReader(); BT.reader = reader;
    let buf = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf.push(...value);
      for (;;) {
        const i = buf.indexOf(0xC0); if (i < 0) { buf = []; break; } if (i > 0) buf = buf.slice(i);
        if (buf.length < 3) break;
        const tot = buf[2] + 4;
        if (tot > 64) { buf.shift(); continue; }
        if (buf.length < tot) break;
        const fr = Uint8Array.from(buf.slice(0, tot)); buf = buf.slice(tot);
        btHandle(new DataView(fr.buffer));
      }
    }
  } catch (e) {
    BT.err = e.name === 'NotFoundError' ? 'Nenhuma porta escolhida (a trena precisa estar pareada no sistema e aparecer como porta serial).' : (e.name || 'Erro') + ': ' + (e.message || '');
    btTrace('erro serial: ' + BT.err); toast(BT.err);
  }
  BT.state = 'off'; BT.writer = null; BT.port = null; BT.reader = null; renderBt();
}
function btDisconnect() {
  if (BT.nat && NAT()) { try { NAT().disconnect(); } catch (e) { } BT.nat = false; BT.state = 'off'; btDisarm(); renderBt(); return; }
  try { if (BT.reader) BT.reader.cancel(); if (BT.writer) BT.writer.releaseLock(); if (BT.port) BT.port.close(); } catch (e) { }
  BT.writer = null; try { if (BT.dev && BT.dev.gatt.connected) BT.dev.gatt.disconnect(); } catch (e) { } BT.state = 'off'; BT.ch = null; btDisarm(); renderBt(); }

/* ---------- gaveta inferior (editor) ---------- */
const isDesk = () => window.matchMedia && window.matchMedia('(min-width:900px)').matches;
function sheetH(st) {
  const H = $('#left').getBoundingClientRect().height || 600;
  return st === 'min' ? 46 : st === 'peek' ? Math.round(Math.min(Math.max(210, H * 0.36), 340)) : Math.round(H * 0.86);
}
function gripTitle() {
  const room = R();
  if (!room) return '';
  if (UI.tab === 'plan') return hasWalls(room) ? 'Parede ' + wnum(room, S.wall) + ' · medidas e itens' : 'Desenhar o contorno';
  return ({ walls: 'Parede ' + (hasWalls(room) ? wnum(room, S.wall) : ''), ceil: 'Forro de gesso', photos: 'Fotos com medidas', export: 'Exportar' })[UI.tab] || '';
}
function applySheet() {
  const sh = $('#sheet'); if (!sh) return;
  if (isDesk()) { sh.style.height = ''; sh.style.bottom = ''; return; }
  UI.sheet = UI.sheet || 'min';
  sh.style.bottom = (document.querySelector('.tabs').offsetHeight || 44) + 'px';
  sh.style.height = sheetH(UI.sheet) + 'px';
  sh.dataset.state = UI.sheet;
  $('#gtitle').textContent = gripTitle() + (UI.sheet === 'min' ? '  ▲' : '');
}
function setSheet(st) { UI.sheet = st; applySheet(); }
function openSheet() { if ((UI.sheet || 'min') === 'min') setSheet('peek'); }

function renderAll() {
  renderHead();
  if (S.cc == null || UI.view !== 'work') renderHome(); else { renderPanel(); renderStage(); applySheet(); }
}

/* ---------- dashboard de clientes e tela do cliente ---------- */
const CLIENT_FIELDS = [['nome', 'Nome do cliente'], ['endereco', 'Endereço'], ['loja', 'Loja'], ['consultor', 'Consultor de vendas'], ['arquiteto', 'Arquiteto']];
const ROOM_SUGG = ['Sala', 'Cozinha', 'Banheiro', 'Dormitório', 'Suíte', 'Lavabo', 'Área de serviço', 'Varanda', 'Closet', 'Escritório'];
function ftext(k, label, val, act, extra) {
  return `<label class="fld"><span>${label}</span><div class="in"><input class="txt" type="text" value="${eh(val || '')}" data-act="${act}" data-k="${k}"${extra || ''}></div></label>`;
}
function roomStat(r) {
  if (!hasWalls(r)) return 'sem contorno ainda · toque para desenhar';
  const s = roomSummary(r), n = r.items.length;
  return `${(s.area / 1e6).toFixed(1).replace('.', ',')} m² · ${r.pts.length} paredes · ${n} ${n === 1 ? 'item' : 'itens'}${r.photos.length ? ' · ' + r.photos.length + ' foto(s)' : ''}`;
}
function renderHome() {
  const el = $('#home');
  let h = '';
  if (S.cc == null) {
    h += `<h2>Clientes</h2><p class="muted small" style="margin:0 0 10px">Cadastre o cliente e, dentro dele, os ambientes que serão medidos.</p>`;
    if (UI.newClient) {
      h += `<div class="card" data-form="client"><h3 style="margin-top:0">Novo cliente</h3><div class="row">${ftext('nome', 'Nome do cliente', '', 'noop', ' data-f="nome"')}${ftext('endereco', 'Endereço', '', 'noop', ' data-f="endereco"')}</div><div class="row" style="margin-top:8px">${ftext('loja', 'Loja', '', 'noop', ' data-f="loja"')}${ftext('consultor', 'Consultor de vendas', '', 'noop', ' data-f="consultor"')}${ftext('arquiteto', 'Arquiteto', '', 'noop', ' data-f="arquiteto"')}</div><div class="row" style="margin-top:8px"><label class="fld"><span>Observações</span><textarea class="txt" rows="3" data-f="obs" data-act="noop"></textarea></label></div><div class="row" style="margin-top:10px"><button class="btn" data-act="clientNew">Cadastrar e abrir</button><button class="btn sec" data-act="clientForm">Cancelar</button></div></div>`;
    } else h += `<div class="row" style="margin-bottom:10px"><button class="btn" data-act="clientForm">+ Novo cliente</button></div>`;
    if (!S.clients.length) h += `<div class="card"><p style="margin:0 0 10px">Nenhum cliente ainda.</p><button class="btn sec sm" data-act="sampleClient">Carregar cliente de exemplo</button></div>`;
    h += `<div class="list">${S.clients.map((c, i) => `<button data-act="clientOpen" data-i="${i}" style="flex-direction:column;gap:2px"><span style="display:flex;justify-content:space-between;gap:8px;width:100%"><b style="font-size:15px">${eh(c.nome || 'Sem nome')}</b><span class="m">${c.rooms.length} ambiente${c.rooms.length === 1 ? '' : 's'}</span></span><span class="m">${eh([c.loja, c.endereco].filter(Boolean).join(' · ') || '—')}</span></button>`).join('')}</div>`;
    if (S.clients.length) h += `<h3>Backup</h3><div class="row"><button class="btn sec sm" data-act="expJson">Salvar backup</button><label class="btn sec sm" style="display:inline-block">Abrir backup<input type="file" accept=".json,application/json" data-act="impJson" hidden></label></div>`;
  } else {
    const c = CL();
    h += `<h2>${eh(c.nome || 'Cliente')}</h2>`;
    h += `<h3>Dados do cliente</h3><div class="card"><div class="row">${ftext('nome', 'Nome', c.nome, 'cf')}${ftext('endereco', 'Endereço', c.endereco, 'cf')}</div><div class="row" style="margin-top:8px">${ftext('loja', 'Loja', c.loja, 'cf')}${ftext('consultor', 'Consultor de vendas', c.consultor, 'cf')}${ftext('arquiteto', 'Arquiteto', c.arquiteto, 'cf')}</div><div class="row" style="margin-top:8px"><label class="fld"><span>Observações</span><textarea class="txt" rows="3" data-act="cf" data-k="obs">${eh(c.obs || '')}</textarea></label></div></div>`;
    h += `<h3>Ambientes a medir</h3>`;
    h += c.rooms.length ? `<div class="list">${c.rooms.map((r, i) => `<button data-act="roomOpen" data-i="${i}" style="flex-direction:column;gap:2px"><b style="font-size:15px">${eh(r.name)}</b><span class="m">${roomStat(r)}</span></button>`).join('')}</div>` : '<p class="muted small">Nenhum ambiente ainda. Crie abaixo.</p>';
    h += `<div class="card" data-form="rooms" style="margin-top:10px"><h3 style="margin-top:0">Criar ambientes</h3><label class="fld"><span>Nomes (separe por vírgula ou linha)</span><textarea class="txt" rows="2" data-f="names" data-act="noop" id="roomNames" placeholder="Sala, Cozinha, Banheiro, Dormitório"></textarea></label><div class="cats" style="margin-top:8px">${ROOM_SUGG.map(n => `<button class="chip" data-act="roomSugg" data-n="${eh(n)}">${eh(n)}</button>`).join('')}</div><div class="row" style="margin-top:8px"><button class="btn" data-act="roomsCreate">Criar ambientes</button></div><p class="muted small" style="margin:8px 0 0">Cada ambiente nasce vazio (pé-direito 2.700 mm): na hora da medição você desenha o contorno com o dedo e informa as medidas.</p></div>`;
    h += `<h3>Exportar</h3><div class="card"><div class="row"><button class="btn" data-act="expPdf" data-v="all">PDF do cliente (${pagesOf(c.rooms)} pág.)</button><button class="btn sec" data-act="expDxf" data-v="all">DXF (um por ambiente)</button></div></div>`;
    h += `<div class="row" style="margin-top:14px"><button class="btn dng sm" data-act="clientDel">${UI.confirm === 'clientDel' ? 'Confirmar: excluir cliente e ambientes?' : 'Excluir cliente'}</button></div>`;
  }
  const keep = el.scrollTop;
  el.innerHTML = '<div class="gut" style="padding-block:12px 28px;max-width:760px;margin:0 auto">' + h + '</div>';
  el.scrollTop = keep;
}


/* ---------- ações ---------- */
function num(el, min) {
  const v = parseIn(el.value);
  if (!isFinite(v) || (min != null && v < min)) { toast('Valor inválido.'); renderPanel(); return null; }
  return v;
}
const curItem = () => R().items.find(x => x.id === UI.sel);
function itemId(el) { return R().items.find(x => x.id === el.dataset.id); }
function overlapOps(room, it) {
  if (it.kind !== 'op') return false;
  return room.items.some(o => o !== it && o.kind === 'op' && o.wall === it.wall && it.u < o.u + o.w - 1 && o.u < it.u + it.w - 1);
}
function placeFree(room, it) {
  if (it.kind !== 'op') return;
  const L = wallLen(room, it.wall);
  for (let u = it.u; u <= L - it.w; u += 100) { it.u = u; if (!overlapOps(room, it)) return; }
  for (let u = Math.max(0, it.u); u >= 0; u -= 100) { it.u = u; if (!overlapOps(room, it)) return; }
}
function field(el) { return el.closest('[data-form]').querySelector('[data-f="' + el.dataset.f + '"]'); }
function formVals(btn) {
  const f = btn.closest('[data-form]'), o = {};
  f.querySelectorAll('[data-f]').forEach(e => { o[e.dataset.f] = e.tagName === 'SELECT' ? e.value : (e.classList.contains('txt') ? e.value : parseIn(e.value)); });
  return o;
}

const A = {
  noop() { },
  tab(el) { UI.tab = el.dataset.v; UI.tool = null; UI.draft = null; UI.confirm = null; if (UI.tab !== 'plan') UI.sheet = (UI.sheet && UI.sheet !== 'min') ? UI.sheet : 'peek'; renderAll(); },
  unit(el) { setUnit(el.dataset.v); S.unit = UNIT; persist(); renderAll(); },
  undo() { doUndo(); },
  back() { if (UI.view === 'work') { UI.view = 'client'; } else { S.cc = null; } UI.confirm = null; UI.addRoom = false; persist(); renderAll(); },
  clientForm() { UI.newClient = !UI.newClient; renderHome(); },
  clientNew(el) {
    const v = formVals(el);
    if (!(v.nome || '').trim()) { toast('Informe o nome do cliente.'); return; }
    tryMut(() => { S.clients.push(newClient({ nome: v.nome.trim(), endereco: v.endereco || '', loja: v.loja || '', consultor: v.consultor || '', arquiteto: v.arquiteto || '', obs: v.obs || '' })); S.cc = S.clients.length - 1; UI.view = 'client'; UI.newClient = false; });
  },
  clientOpen(el) { S.cc = +el.dataset.i; UI.view = 'client'; S.cur = 0; S.wall = 0; UI.confirm = null; persist(); renderAll(); },
  clientDel() {
    if (UI.confirm !== 'clientDel') { UI.confirm = 'clientDel'; renderHome(); return; }
    UI.confirm = null;
    tryMut(() => { S.clients.splice(S.cc, 1); S.cc = null; });
  },
  cf(el) { CL()[el.dataset.k] = el.value; persist(); renderHead(); },
  sampleClient() { tryMut(() => { const st = sampleState(); S.clients.push(st.clients[0]); }); },
  roomSugg(el) {
    const t = $('#roomNames'), n = el.dataset.n, cur = t.value.trim();
    t.value = cur ? (/[,\n]\s*$/.test(cur) ? cur + ' ' + n : cur + ', ' + n) : n;
  },
  roomsCreate(el) {
    const names = ($('#roomNames').value || '').split(/[,\n;]+/).map(x => x.trim()).filter(Boolean);
    if (!names.length) { toast('Digite ou toque nos nomes dos ambientes.'); return; }
    tryMut(() => { for (const n of names) CL().rooms.push(newRoom(n, 0, 0, 2700)); });
  },
  roomOpen(el) { S.cur = +el.dataset.i; S.wall = 0; UI.strokes = []; UI.selCorner = null; UI.sheet = 'min'; UI.tab = 'plan'; UI.view = 'work'; UI.tab = 'plan'; UI.sel = UI.selCeil = UI.selAnn = UI.selDrain = UI.selPhoto = null; UI.uv = null; undoStack = []; persist(); renderAll(); },
  traceDone() {
    const pts = [].concat(...UI.strokes);
    const res = traceToPoly(pts);
    UI.strokes = []; UI.stroke = null;
    if (!res.ok) { toast(res.msg); renderAll(); return; }
    tryMut(() => { const r = R(); r.pts = res.pts; r.wn = res.wn; r.wsrc = res.pts.map(() => null); r.wt = []; UI.uv = null; UI.selCorner = null; S.wall = wallOrder(r)[0]; });
    setSheet('peek');
    toast('Contorno ajustado. Agora informe a medida real de cada parede.');
  },
  traceClear() { UI.strokes = []; UI.stroke = null; renderAll(); },
  rectRoom(el) {
    const v = formVals(el);
    if (!(v.w >= 500 && v.l >= 500)) { toast('Informe largura e profundidade (mín. 500 mm).'); return; }
    tryMut(() => { const nr = newRoom(R().name, v.w, v.l, R().H); const r = R(); r.pts = nr.pts; r.wsrc = nr.wsrc; r.wn = undefined; UI.uv = null; S.wall = 0; });
  },
  redraw() {
    if (UI.confirm !== 'redraw') { UI.confirm = 'redraw'; renderPanel(); return; }
    UI.confirm = null;
    tryMut(() => { const r = R(); r.pts = []; r.wsrc = []; r.wt = []; r.wn = undefined; r.items = []; r.ceil = []; r.drains = []; UI.strokes = []; UI.uv = null; UI.sel = UI.selCeil = UI.selDrain = UI.selCorner = null; S.wall = 0; });
  },
  drAdd() { tryMut(() => { const d = newDrain(R()); R().drains.push(d); UI.selDrain = d.id; }); },
  drSel(el) { UI.selDrain = el.dataset.id; renderAll(); },
  drDia(el) { const v = num(el, 20); if (v == null) return; const d = R().drains.find(x => x.id === el.dataset.id); tryMut(() => { d.d = v; }); },
  drXl(el) { A._dr(el, 'xl'); }, drXr(el) { A._dr(el, 'xr'); }, drYb(el) { A._dr(el, 'yb'); }, drYt(el) { A._dr(el, 'yt'); },
  _dr(el, k) {
    const v = num(el, 0); if (v == null) return;
    const d = R().drains.find(x => x.id === el.dataset.id), src = el.dataset.src || 'manual';
    tryMut(() => {
      const ry = drainRays(R(), [d.x, d.y]);
      if (k === 'xl') d.x = ry.xl + v; else if (k === 'xr') d.x = ry.xr - v; else if (k === 'yb') d.y = ry.yb + v; else d.y = ry.yt - v;
      d.src = src;
      if (!pointInPoly([d.x, d.y], R().pts)) return { ok: false, msg: 'O ralo precisa ficar dentro do ambiente.' };
    });
  },
  drDel() { const id = UI.selDrain; tryMut(() => { R().drains = R().drains.filter(x => x.id !== id); UI.selDrain = null; }); },
  roomObs(el) { R().obs = el.value; persist(); },
  room(el) { S.cur = +el.dataset.i; S.wall = 0; UI.strokes = []; UI.selCorner = null; UI.sheet = 'min'; UI.tab = 'plan'; UI.sel = UI.selCeil = UI.selAnn = UI.selDrain = null; UI.selPhoto = null; UI.uv = null; UI.addRoom = false; undoStack = []; persist(); renderAll(); },
  roomAdd() { UI.addRoom = !UI.addRoom; renderPanel(); },
  roomNew(el) {
    const v = formVals(el);
    if (!(v.h >= 1000)) { toast('Pé-direito mínimo: 1.000 mm.'); return; }
    tryMut(() => { CL().rooms.push(newRoom((v.name || '').trim() || 'Ambiente', 0, 0, v.h)); S.cur = CL().rooms.length - 1; S.wall = 0; UI.addRoom = false; UI.uv = null; UI.sel = UI.selCeil = null; UI.strokes = []; UI.tab = 'plan'; });
  },
  roomName(el) { tryMut(() => { R().name = el.value.trim() || R().name; }); },
  roomTw(el) { const v = num(el, 20); if (v == null) return; tryMut(() => { R().tw = v; }); },
  wallT(el) { const v = num(el, 20); if (v == null) return; const i = +el.dataset.i; tryMut(() => { const r = R(); r.wt = r.wt || []; r.wt[i] = v === (r.tw || 120) ? 0 : v; }); },
  roomH(el) { const v = num(el, 1000); if (v == null) return; const src = el.dataset.src || 'manual'; tryMut(() => { R().H = v; R().Hsrc = src; for (const it of R().items) { if (it.kind === 'op') it.h = Math.min(it.h, Math.max(100, v - it.z)); } }); },
  roomDel(el) {
    if (UI.confirm !== 'roomDel') { UI.confirm = 'roomDel'; renderPanel(); return; }
    UI.confirm = null; tryMut(() => { CL().rooms.splice(S.cur, 1); S.cur = 0; S.wall = 0; UI.uv = null; UI.view = 'client'; });
  },
  wall(el) { S.wall = +el.dataset.i; UI.sel = null; UI.uv = null; persist(); renderAll(); },
  wallLen(el) { const v = num(el, 50); if (v == null) return; const src = el.dataset.src || 'manual'; tryMut(() => setWallLen(R(), +el.dataset.i, v, src)); },
  goWall(el) { S.wall = +el.dataset.i; UI.tab = 'walls'; UI.uv = null; renderAll(); },
  goItem(el) { S.wall = +el.dataset.i; UI.sel = el.dataset.id; UI.tab = 'walls'; UI.uv = null; renderAll(); },
  notch(el) {
    const v = formVals(el);
    tryMut(() => { const i = S.wall; const r = addNotch(R(), i, v.u0, v.w, v.type === 'pilar' ? v.d : -v.d); UI.uv = null; return r; });
  },
  libCat(el) { UI.libCat = el.dataset.v; renderPanel(); },
  libAdd(el) {
    tryMut(() => {
      const room = R(), it = makeItem(el.dataset.t, S.wall, room);
      it.h = it.kind === 'op' ? Math.min(it.h, Math.max(100, room.H - it.z)) : it.h;
      placeFree(room, it);
      room.items.push(it); UI.sel = it.id;
    });
  },
  sel(el) { UI.sel = el.dataset.id; renderAll(); },
  itName(el) { const it = itemId(el); tryMut(() => { it.name = el.value.trim() || it.name; }); },
  itW(el) { const v = num(el, 10); if (v == null) return; const it = itemId(el), src = el.dataset.src || 'manual'; tryMut(() => { it.w = v; it.src = src; if (it.kind === 'op') { const L = wallLen(R(), it.wall); it.u = clamp(it.u, 0, Math.max(0, L - it.w)); if (overlapOps(R(), it)) return { ok: false, msg: 'A esquadria encostaria em outra.' }; } }); },
  itH(el) { const v = num(el, 10); if (v == null) return; const it = itemId(el), src = el.dataset.src || 'manual'; tryMut(() => { it.h = v; it.src = src; if (it.kind === 'op' && it.z + it.h > R().H + 0.5) return { ok: false, msg: 'A esquadria passaria do pé-direito.' }; }); },
  itUL(el) { const v = num(el, 0); if (v == null) return; const it = itemId(el), src = el.dataset.src || 'manual'; tryMut(() => { const L = wallLen(R(), it.wall); it.u = it.kind === 'op' ? clamp(v, 0, Math.max(0, L - it.w)) : clamp(v, 0, L); it.src = src; if (overlapOps(R(), it)) return { ok: false, msg: 'A esquadria encostaria em outra.' }; }); },
  itUR(el) { const v = num(el, 0); if (v == null) return; const it = itemId(el), src = el.dataset.src || 'manual'; tryMut(() => { const L = wallLen(R(), it.wall); const u = it.kind === 'op' ? L - v - it.w : L - v; it.u = it.kind === 'op' ? clamp(u, 0, Math.max(0, L - it.w)) : clamp(u, 0, L); it.src = src; if (overlapOps(R(), it)) return { ok: false, msg: 'A esquadria encostaria em outra.' }; }); },
  itZ(el) { const v = num(el, 0); if (v == null) return; const it = itemId(el), src = el.dataset.src || 'manual'; tryMut(() => { it.z = Math.min(v, R().H); it.src = src; }); },
  itTop(el) { const v = num(el, 0); if (v == null) return; const it = itemId(el); tryMut(() => { it.z = Math.max(0, R().H - v - it.h); }); },
  itHinge(el) { const it = itemId(el); tryMut(() => { it.hinge = el.value; }); },
  itSwing(el) { const it = itemId(el); tryMut(() => { it.swing = el.value; }); },
  itShape(el) { const it = itemId(el); tryMut(() => { it.shape = el.value; }); },
  itDup() {
    const it = curItem(); if (!it) return;
    tryMut(() => { const c = JSON.parse(JSON.stringify(it)); c.id = uid('i'); c.u = it.kind === 'op' ? it.u + it.w + 50 : it.u + 200; const L = wallLen(R(), c.wall); c.u = clamp(c.u, 0, it.kind === 'op' ? Math.max(0, L - c.w) : L); if (c.kind === 'op') placeFree(R(), c); R().items.push(c); UI.sel = c.id; });
  },
  itDel() { const it = curItem(); if (!it) return; tryMut(() => { R().items = R().items.filter(x => x !== it && x.id !== it.id); UI.sel = null; }); },
  meas(el) {
    const input = document.getElementById(el.dataset.t);
    if (!input) return;
    if (BT.state === 'on') {
      btDisarm(); BT.armed = el.dataset.t; el.classList.add('armed');
      BT.timer = setTimeout(btDisarm, 90000);
      toast('Meça na trena: a leitura entra neste campo.');
      return;
    }
    const cur = parseIn(input.value);
    input.value = inv(simRead(cur));
    input.dataset.src = 'laser';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },
  conectar() { if (BT.state === 'on') btDisconnect(); else if (BT.state !== 'conn' || NAT()) { if (NAT()) natConnect(); else btConnect(false); } },
  conectarTodos() { btConnect(true); },
  conectarSerial() { serConnect(); },
  conectarSerialTodas() { serConnect(true); },
  btSync() { btSend(CMD_SYNC, 'sincronizacao C0 55 02 01 00 1A'); },
  btStart() { btSend([0xC0, 0x40, 0x00, 0xEE], 'iniciar medicao C0 40 00 EE'); },
  btLaser() { btSend(CMD_LASER, 'laser C0 56 01 00 1E'); },
  btCopy() { const t = BT.trace.join('\n'); try { navigator.clipboard.writeText(t).then(() => toast('Registro copiado.'), () => toast('Não consegui copiar: selecione o texto do registro.')); } catch (e) { toast('Não consegui copiar: selecione o texto do registro.'); } },
  /* forro */
  cNewRoom() { tryMut(() => { const e = newCeil('room', R()); R().ceil.unshift(e); UI.selCeil = e.id; }); },
  cNewRect() {
    tryMut(() => {
      const room = R(), e = newCeil('rect', room);
      if (!(e.w >= 100 && e.h >= 100) || !rectInsideRoom(e.x, e.y, e.w, e.h, room.pts)) {
        const b = bbox(room.pts); const w = Math.max(200, b.w / 2), h = Math.max(200, b.h / 2);
        Object.assign(e, { x: b.x0 + (b.w - w) / 2, y: b.y0 + (b.h - h) / 2, w, h });
        if (!rectInsideRoom(e.x, e.y, e.w, e.h, room.pts)) return { ok: false, msg: 'Não coube um rebaixo padrão. Use “Desenhar rebaixo”.' };
      }
      room.ceil.push(e); UI.selCeil = e.id;
    });
  },
  cFree(el) {
    const k = el.dataset.v;
    if (UI.tool === 'free' && UI.freeKind === k) UI.tool = null; else { UI.tool = 'free'; UI.freeKind = k; UI.cstroke = null; setSheet('min'); }
    renderAll();
  },
  cNh(el) { const v = num(el, 1); if (v == null) return; const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { if (v <= R().H - e.drop) return { ok: false, msg: 'O pé-direito do negativo deve passar da altura do forro (' + fmt(R().H - e.drop, UNIT, true) + ').' }; e.nh = v; }); },
  cEo(el) {
    const v = num(el, 0); if (v == null) return;
    const e = R().ceil.find(x => x.id === el.dataset.id), k = +el.dataset.k;
    tryMut(() => {
      const n = ceilBase(R(), e).length; e.eo = e.eo || []; while (e.eo.length < n) e.eo.push(0);
      e.eo[k] = Math.max(0, v);
      const base = ceilBase(R(), e), res = offsetPolyVar(base, e.eo);
      if (Math.sign(area2(res)) !== Math.sign(area2(base)) || !polySimple(res)) return { ok: false, msg: 'Esse recuo inverte o forro. Use um valor menor.' };
    });
  },
  cEoReset(el) { const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.eo = []; }); },
  cDraw() { UI.tool = UI.tool === 'draw' ? null : 'draw'; UI.draft = null; renderAll(); },
  cSel(el) { UI.selCeil = el.dataset.id; renderAll(); },
  cName(el) { const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.name = el.value.trim() || e.name; }); },
  cDrop(el) { const v = num(el, 0); if (v == null) return; const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.drop = Math.min(v, R().H - 500); }); },
  cTrim(el) { const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.trim = el.value; if (e.trim === 'neg' && !e.nh) e.nh = R().H + 100; }); },
  cTw(el) { const v = num(el, 1); if (v == null) return; const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.tw = v; }); },
  cTh(el) { const v = num(el, 1); if (v == null) return; const e = R().ceil.find(x => x.id === el.dataset.id); tryMut(() => { e.th = v; }); },
  cX(el) { A._cRect(el, 'x'); }, cY(el) { A._cRect(el, 'y'); }, cW(el) { A._cRect(el, 'w'); }, cH(el) { A._cRect(el, 'h'); },
  _cRect(el, k) {
    const v = num(el, 0); if (v == null) return;
    const b = bbox(R().pts), e = R().ceil.find(x => x.id === el.dataset.id);
    tryMut(() => {
      if (k === 'x') e.x = b.x0 + v; else if (k === 'y') e.y = b.y0 + v; else e[k] = v;
      if (!rectInsideRoom(e.x, e.y, e.w, e.h, R().pts)) return { ok: false, msg: 'O forro precisa ficar dentro das paredes do ambiente.' };
    });
  },
  cDel() { const id = UI.selCeil; tryMut(() => { R().ceil = R().ceil.filter(x => x.id !== id); UI.selCeil = null; }); },
  /* fotos */
  phSel(el) { UI.selPhoto = el.dataset.id; UI.selAnn = null; UI.uv = null; renderAll(); },
  phTitle(el) { const p = R().photos.find(x => x.id === UI.selPhoto); tryMut(() => { p.title = el.value; }); },
  phDel() {
    if (UI.confirm !== 'phDel') { UI.confirm = 'phDel'; renderPanel(); return; }
    UI.confirm = null; const id = UI.selPhoto;
    tryMut(() => { R().photos = R().photos.filter(p => p.id !== id); try { localStorage.removeItem('tegora:ph:' + id); } catch (e) { } delete PHOTOS[id]; UI.selPhoto = R().photos[0] ? R().photos[0].id : null; UI.selAnn = null; UI.uv = null; });
  },
  tool(el) { UI.tool = UI.tool === el.dataset.v ? null : el.dataset.v; UI.selAnn = null; renderAll(); },
  annColor(el) {
    const p = R().photos.find(x => x.id === UI.selPhoto), an = p && p.ann.find(a => a.id === UI.selAnn);
    if (an) tryMut(() => { an.color = el.dataset.v; }); else { UI.annColor = el.dataset.v; renderPanel(); }
  },
  anMm(el) { const v = num(el, 0); if (v == null) return; const p = R().photos.find(x => x.id === UI.selPhoto), an = p.ann.find(a => a.id === el.dataset.id); const src = el.dataset.src || 'manual'; tryMut(() => { an.mm = v; an.src = src; }); },
  anLbl(el) { const p = R().photos.find(x => x.id === UI.selPhoto), an = p.ann.find(a => a.id === el.dataset.id); tryMut(() => { an.lbl = el.value.trim(); }); },
  anDel() { const p = R().photos.find(x => x.id === UI.selPhoto), id = UI.selAnn; tryMut(() => { p.ann = p.ann.filter(a => a.id !== id); UI.selAnn = null; }); },
  /* exportar */
  expPdf(el) { exportPdf(el.dataset.v); }, expDxf(el) { exportDxf(el.dataset.v); }, expJson() { exportJson(); },
};
function resetTo(st) { S = st; setUnit(S.unit || 'mm'); undoStack = []; UI.sel = UI.selCeil = UI.selAnn = UI.selPhoto = UI.selDrain = null; UI.uv = null; UI.view = 'client'; persist(); renderAll(); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT' || b.closest('#cv')) return;
  if (b.tagName === 'LABEL') return;
  const fn = A[b.dataset.act];
  if (fn) fn(b, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.matches || !el.matches('input[data-act],select[data-act],textarea[data-act]')) return;
  if (el.type === 'file') { if (el.dataset.act === 'phFile') addPhotos(el.files); else if (el.dataset.act === 'impJson') importJson(el.files[0]); el.value = ''; return; }
  const fn = A[el.dataset.act];
  if (fn) fn(el, e);
  delete el.dataset.src;
});

/* ---------- fotos ---------- */
function compress(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(im.width, im.height));
        const w = Math.round(im.width * sc), h = Math.round(im.height * sc);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        res({ url: cv.toDataURL('image/jpeg', 0.82), w, h });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function addPhotos(files) {
  const list = Array.from(files || []);
  for (const f of list) {
    try {
      const o = await compress(f);
      const id = uid('p');
      PHOTOS[id] = o; persistPhoto(id);
      tryMut(() => { R().photos.push({ id, w: o.w, h: o.h, title: '', ann: [] }); UI.selPhoto = id; UI.selAnn = null; UI.uv = null; });
    } catch (e) { toast('Não consegui ler essa imagem.'); }
  }
}

/* ---------- exportação ---------- */
async function getDl() {
  try { if (window.claude && claude.use) return await claude.use('downloads'); } catch (e) { }
  return null;
}
async function saveFile(name, data) {
  const N = NAT();
  if (N) {
    try {
      const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
      let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      N.save(name, btoa(bin)); return;
    } catch (e) { toast('Não foi possível salvar o arquivo (' + (e.message || e) + ').'); return; }
  }
  const d = await getDl();
  try {
    if (d) { await d.save({ filename: name, data }); toast('Arquivo pronto: ' + name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('Arquivo gerado: ' + name);
  } catch (e) {
    if (e && e.code === 'declined') return;
    toast('Não foi possível salvar o arquivo' + (e && e.message ? ' (' + e.message + ')' : '') + '.');
  }
}
const slug = s => (s || 'projeto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projeto';
const baseName = () => 'tegora-' + slug(CL().nome) + '-' + today();
function roomsFor(which) { return which === 'room' ? [R()] : CL().rooms; }
function exportPdf(which) {
  try {
    const rooms = roomsFor(which);
    const pb = {};
    for (const r of rooms) for (const p of r.photos) {
      const ph = PHOTOS[p.id]; if (!ph) continue;
      pb[p.id] = { bytes: b64ToBytes(ph.url.split(',')[1]), w: ph.w, h: ph.h };
    }
    if (!pagesOf(rooms)) { toast('Desenhe o contorno de pelo menos um ambiente antes.'); return; }
    const bytes = buildPdf(projOf(CL(), UNIT, rooms), pb);
    saveFile(baseName() + (which === 'room' ? '-' + slug(R().name) : '') + '.pdf', bytes);
  } catch (e) { toast('Falha ao gerar o PDF: ' + e.message); }
}
function exportDxf(which) {
  try {
    const rooms = roomsFor(which).filter(hasWalls), proj = projOf(CL(), UNIT, rooms);
    if (!rooms.length) { toast('Desenhe o contorno de pelo menos um ambiente antes.'); return; }
    const used = {};
    const files = rooms.map((r, i) => {
      let n = slug(CL().nome) + '-' + slug(r.name); if (used[n]) n += '-' + (++used[n]); else used[n] = 1;
      const dxf = buildDxf(proj, i), er = validarDxf(dxf);
      if (er.length) throw new Error('DXF invalido (' + r.name + '): ' + er.join('; '));
      return { name: n + '.dxf', data: utf8(dxf) };
    });
    const readme = 'Tegora - Conferencia de medidas\r\n\r\nUm arquivo DXF por ambiente, somente a planta baixa (AutoCAD R12, 1 unidade = 1 mm).\r\nSomente LINE, ARC e CIRCLE. Sem textos, cotas, blocos, hachuras ou logotipo.\r\nLayers: TG_PAREDES (face interna = medida da trena, e face externa = interna + espessura da parede), TG_ESQUADRIAS, TG_HIDRAULICA (ralos).\r\nLinhas terminadas em CRLF, numeros com ponto decimal.\r\n';
    files.push({ name: 'LEIA-ME.txt', data: utf8(readme) });
    saveFile(baseName() + '-dxf.zip', makeZip(files));
  } catch (e) { toast('Falha ao gerar o DXF: ' + e.message); }
}
function exportJson() {
  const ph = {};
  for (const c of S.clients) for (const r of c.rooms) for (const p of r.photos) if (PHOTOS[p.id]) ph[p.id] = PHOTOS[p.id];
  saveFile('tegora-backup-' + today() + '.json', JSON.stringify({ tegora: 2, state: S, photos: ph }));
}
async function importJson(f) {
  if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    const st = migrateState(o.state || o);
    if (!st) throw new Error('inválido');
    for (const id in (o.photos || {})) { PHOTOS[id] = o.photos[id]; persistPhoto(id); }
    let n = 0;
    for (const c of st.clients) { const k = S.clients.findIndex(x => x.id === c.id); if (k >= 0) S.clients[k] = c; else S.clients.push(c); n++; }
    S.cc = null; persist(); renderAll(); toast(n + ' cliente(s) importado(s).');
  } catch (e) { toast('Esse arquivo não é um backup do Tégora.'); }
}

/* ---------- interação no desenho ---------- */
const ptrs = new Map();
let drag = null, pinch = null;
const stageEl = () => $('#stage');
const rel = e => { const r = stageEl().getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const curView = () => new View(UI.curV.s, UI.curV.ox, UI.curV.oy);
function setUV(v) { UI.uv = { key: UI.vkey, s: v.s, ox: v.ox, oy: v.oy }; }
function snapPt(p, v) {
  const room = R(), tol = 10 / v.s;
  const xs = room.pts.map(q => q[0]), ys = room.pts.map(q => q[1]);
  for (const e of room.ceil) if (e.kind === 'rect') { xs.push(e.x, e.x + e.w); ys.push(e.y, e.y + e.h); }
  const sn = (val, arr) => { let b = null, bd = tol; for (const a of arr) if (Math.abs(a - val) < bd) { bd = Math.abs(a - val); b = a; } return b == null ? rnd(val, 10) : b; };
  return [sn(p[0], xs), sn(p[1], ys)];
}
const phNorm = (px, py, ph) => { const v = curView(); return [((px - v.ox) / v.s) / ph.w, ((py - (v.oy - ph.h * v.s)) / v.s) / ph.w]; };

function onDown(e) {
  if (e.target.closest('#hud')) return;
  stageEl().setPointerCapture(e.pointerId);
  const [px, py] = rel(e);
  ptrs.set(e.pointerId, [px, py]);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, v: curView(), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    drag = null; UI.draft = null; return;
  }
  const idEl = e.target.closest && e.target.closest('[data-id]');
  const id = idEl ? idEl.getAttribute('data-id') : null;
  const v = curView(), w = v.inv(px, py);
  drag = { px, py, moved: false, kind: 'pan', id, v0: v, w0: w, snap: null };
  const room = R();
  if (UI.tab === 'plan' && !hasWalls(room)) { drag.kind = 'trace'; UI.stroke = [w]; return; }
  if (UI.tab === 'plan' && id && id.startsWith('c:')) {
    UI.selCorner = +id.slice(2); openSheet(); drag.kind = 'corner'; drag.k = UI.selCorner; drag.snap = JSON.stringify(S); drag.room0 = JSON.stringify(room); renderPanel(); renderStage();
  } else if (UI.tab === 'plan' && id && id.startsWith('r:')) {
    const d = room.drains.find(x => x.id === id.slice(2));
    if (d) { drag.kind = 'drain'; drag.d = d; drag.off = [w[0] - d.x, w[1] - d.y]; drag.snap = JSON.stringify(S); UI.selDrain = d.id; openSheet(); renderPanel(); renderStage(); }
  } else if (UI.tab === 'plan' && id && id.startsWith('w:')) drag.kind = 'tapWall';
  else if (UI.tab === 'walls' && id && id.startsWith('i:')) {
    const it = room.items.find(x => x.id === id.slice(2));
    if (it) { drag.kind = 'item'; drag.it = it; drag.off = [w[0] - it.u, w[1] - zc(it)]; UI.sel = it.id; openSheet(); drag.snap = JSON.stringify(S); drag.moved0 = false; renderPanel(); renderStage(); }
  } else if (UI.tab === 'ceil') {
    if (UI.tool === 'free') { drag.kind = 'ctrace'; UI.cstroke = [w]; }
    else if (UI.tool === 'draw') { drag.kind = 'draw'; const p = snapPt(w, v); UI.draft = { a: p, b: p }; }
    else if (id && id.startsWith('f:')) {
      const el = room.ceil.find(x => x.id === id.slice(2));
      if (el) { UI.selCeil = el.id; openSheet(); drag.kind = el.kind === 'rect' ? 'fmove' : 'tapOnly'; drag.el = el; drag.off = [w[0] - el.x, w[1] - el.y]; drag.snap = JSON.stringify(S); renderPanel(); renderStage(); }
    }
  } else if (UI.tab === 'photos') {
    const ph = room.photos.find(p => p.id === UI.selPhoto);
    if (ph) {
      if (id && id.startsWith('h:')) { const [, aid, k] = id.split(':'); drag.kind = 'handle'; drag.an = ph.ann.find(a => a.id === aid); drag.k = +k; drag.ph = ph; drag.snap = JSON.stringify(S); }
      else if (id && id.startsWith('a:')) { const an = ph.ann.find(a => a.id === id.slice(2)); if (an) { UI.selAnn = an.id; drag.kind = 'amove'; drag.an = an; drag.ph = ph; drag.n0 = phNorm(px, py, ph); drag.orig = [an.x1, an.y1, an.x2, an.y2]; drag.snap = JSON.stringify(S); renderPanel(); renderStage(); } }
      else if (UI.tool) { drag.kind = 'annNew'; drag.ph = ph; drag.n0 = phNorm(px, py, ph); }
    }
  }
}
function onMove(e) {
  if (!ptrs.has(e.pointerId)) return;
  const [px, py] = rel(e);
  ptrs.set(e.pointerId, [px, py]);
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const k = d / pinch.d, v0 = pinch.v;
    const s = clamp(v0.s * k, v0.s * 0.05, v0.s * 40);
    const wx = (pinch.c[0] - v0.ox) / v0.s, wy = (v0.oy - pinch.c[1]) / v0.s;
    setUV(new View(s, c[0] - s * wx, c[1] + s * wy)); renderStage(); return;
  }
  if (!drag) return;
  const dx = px - drag.px, dy = py - drag.py;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  const v = drag.v0, room = R();
  if (drag.kind === 'pan' || drag.kind === 'tapWall' || drag.kind === 'tapOnly') { setUV(new View(v.s, v.ox + dx, v.oy + dy)); drag.kind = drag.kind === 'tapOnly' ? 'pan' : 'pan'; renderStage(); return; }
  const w = curView().inv(px, py);
  if (drag.kind === 'ctrace') { const l = UI.cstroke[UI.cstroke.length - 1]; if (Math.hypot(w[0] - l[0], w[1] - l[1]) > 4 / curView().s) UI.cstroke.push(w); renderStage(); return; }
  if (drag.kind === 'trace') { const l = UI.stroke[UI.stroke.length - 1]; if (Math.hypot(w[0] - l[0], w[1] - l[1]) > 4 / curView().s) UI.stroke.push(w); renderStage(); return; }
  if (drag.kind === 'corner') {
    const rr = JSON.parse(drag.room0), t = [rnd(w[0], 10), rnd(w[1], 10)];
    if (moveCorner(rr, drag.k, t)) { S.cc != null && Object.assign(room, rr); drag.okMoved = true; }
    renderStage(); return;
  }
  if (drag.kind === 'item') {
    const it = drag.it, L = wallLen(room, it.wall);
    if (!drag.moved0) { drag.moved0 = true; }
    if (it.kind === 'op') it.u = clamp(rnd(w[0] - drag.off[0], 5), 0, Math.max(0, L - it.w));
    else { it.u = clamp(rnd(w[0] - drag.off[0], 5), 0, L); const nc = clamp(rnd(w[1] - drag.off[1], 5), 0, room.H); it.z = it.zb ? Math.max(0, nc - it.h / 2) : nc; }
    renderStage();
  } else if (drag.kind === 'drain') {
    drag.d.x = rnd(w[0] - drag.off[0], 10); drag.d.y = rnd(w[1] - drag.off[1], 10); renderStage();
  } else if (drag.kind === 'draw') {
    UI.draft.b = snapPt(w, curView()); renderStage();
  } else if (drag.kind === 'fmove') {
    const el = drag.el;
    el.x = rnd(w[0] - drag.off[0], 10); el.y = rnd(w[1] - drag.off[1], 10); renderStage();
  } else if (drag.kind === 'handle') {
    const n = phNorm(px, py, drag.ph), an = drag.an;
    if (drag.k === 1) { an.x1 = n[0]; an.y1 = n[1]; } else { an.x2 = n[0]; an.y2 = n[1]; }
    renderStage();
  } else if (drag.kind === 'amove') {
    const n = phNorm(px, py, drag.ph), an = drag.an, o = drag.orig, ddx = n[0] - drag.n0[0], ddy = n[1] - drag.n0[1];
    an.x1 = o[0] + ddx; an.y1 = o[1] + ddy; an.x2 = o[2] + ddx; an.y2 = o[3] + ddy; renderStage();
  } else if (drag.kind === 'annNew') {
    const n = phNorm(px, py, drag.ph);
    UI.tmpAnn = { id: '_tmp', kind: UI.tool === 'seta' ? 'arrow' : 'dim', x1: drag.n0[0], y1: drag.n0[1], x2: n[0], y2: n[1], mm: 0, lbl: '', color: UI.annColor };
    drag.ph.ann.push(UI.tmpAnn); renderStage(); drag.ph.ann.pop();
  }
}
function onUp(e) {
  ptrs.delete(e.pointerId);
  if (pinch) { if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null; return; }
  const d = drag; drag = null;
  if (!d) return;
  const room = R();
  if (d.kind === 'ctrace') {
    const st = UI.cstroke; UI.cstroke = null;
    if (!st || st.length < 6) { renderStage(); return; }
    const res = traceToPoly(st);
    if (!res.ok) { toast(res.msg); renderStage(); return; }
    if (!res.pts.every(p => pointInPoly(p, room.pts))) { toast('O contorno precisa ficar dentro das paredes do ambiente.'); renderStage(); return; }
    const sanca = UI.freeKind === 'sanca';
    tryMut(() => {
      const n = room.ceil.filter(q => q.kind === 'poly' && !!q.sanca === sanca).length + 1;
      const el = newCeil('poly', room, { pts: res.pts, sanca, name: (sanca ? 'Sanca à mão livre ' : 'Rebaixo à mão livre ') + n, drop: sanca ? 150 : 100, trim: sanca ? 'neg' : 'none', tw: sanca ? 60 : 30, nh: room.H + 100 });
      room.ceil.push(el); UI.selCeil = el.id; UI.tool = null; setSheet('peek');
    });
    return;
  }
  if (d.kind === 'trace') {
    const st = UI.stroke; UI.stroke = null;
    if (st && st.length > 3) UI.strokes.push(st);
    const all = [].concat(...UI.strokes);
    if (all.length > 10) {
      const b = bbox(all), D = Math.max(b.w, b.h), a0 = all[0], z = all[all.length - 1];
      if (Math.hypot(a0[0] - z[0], a0[1] - z[1]) < 0.12 * D) { A.traceDone(); return; }
    }
    renderAll(); return;
  }
  if (d.kind === 'corner') { if (d.moved && d.okMoved) { pushUndo(d.snap); persist(); } renderAll(); return; }
  if (d.kind === 'tapWall' && !d.moved) { S.wall = +d.id.slice(2); UI.sheet = (UI.sheet && UI.sheet !== 'min') ? UI.sheet : 'peek'; persist(); renderAll(); return; }
  if (d.kind === 'pan' && !d.moved) {
    if (UI.tab === 'walls' && UI.sel) { UI.sel = null; renderAll(); }
    else if (UI.tab === 'plan' && (UI.selDrain || UI.selCorner != null)) { UI.selDrain = null; UI.selCorner = null; renderAll(); }
    else if (UI.tab === 'ceil' && UI.selCeil && UI.tool !== 'draw') { UI.selCeil = null; renderAll(); }
    else if (UI.tab === 'photos' && UI.selAnn) { UI.selAnn = null; renderAll(); }
    return;
  }
  if (d.kind === 'item') {
    if (!d.moved) return;
    if (overlapOps(room, d.it)) { S = JSON.parse(d.snap); toast('A esquadria encostaria em outra.'); renderAll(); return; }
    d.it.src = 'manual'; pushUndo(d.snap); persist(); renderAll(); return;
  }
  if (d.kind === 'drain') {
    if (!d.moved) return;
    if (!pointInPoly([d.d.x, d.d.y], room.pts)) { S = JSON.parse(d.snap); toast('O ralo precisa ficar dentro do ambiente.'); renderAll(); return; }
    d.d.src = 'manual'; pushUndo(d.snap); persist(); renderAll(); return;
  }
  if (d.kind === 'fmove') {
    if (!d.moved) return;
    const el = d.el;
    if (!rectInsideRoom(el.x, el.y, el.w, el.h, room.pts)) { S = JSON.parse(d.snap); toast('O forro precisa ficar dentro das paredes.'); renderAll(); return; }
    pushUndo(d.snap); persist(); renderAll(); return;
  }
  if (d.kind === 'draw') {
    const a = UI.draft.a, b = UI.draft.b; UI.draft = null;
    const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
    if (w < 50 || h < 50) { renderStage(); return; }
    if (!rectInsideRoom(x, y, w, h, room.pts)) { toast('O forro precisa ficar dentro das paredes do ambiente.'); renderStage(); return; }
    tryMut(() => { const el = newCeil('rect', room, { x, y, w, h, name: 'Forro rebaixado ' + (room.ceil.filter(q => q.kind === 'rect').length + 1) }); room.ceil.push(el); UI.selCeil = el.id; UI.tool = null; });
    return;
  }
  if (d.kind === 'handle' || d.kind === 'amove') { if (d.moved) { pushUndo(d.snap); persist(); } renderAll(); return; }
  if (d.kind === 'annNew') {
    if (!d.moved) return;
    const [px, py] = rel(e), n = phNorm(px, py, d.ph);
    if (Math.hypot(n[0] - d.n0[0], n[1] - d.n0[1]) < 0.02) { renderStage(); return; }
    tryMut(() => { const an = { id: uid('a'), kind: UI.tool === 'seta' ? 'arrow' : 'dim', x1: d.n0[0], y1: d.n0[1], x2: n[0], y2: n[1], mm: 0, lbl: '', color: UI.annColor, src: 'manual' }; d.ph.ann.push(an); UI.selAnn = an.id; UI.tool = null; });
    if (UI.selAnn) toast('Agora informe a medida no painel (ou use “Medir”).');
  }
}
function onWheel(e) {
  e.preventDefault();
  const [px, py] = rel(e), v = curView();
  const k = Math.exp(-e.deltaY * 0.0015), s = clamp(v.s * k, v.s * 0.1, v.s * 20);
  const wx = (px - v.ox) / v.s, wy = (v.oy - py) / v.s;
  setUV(new View(s, px - s * wx, py + s * wy)); renderStage();
}

/* ---------- inicialização ---------- */
function drawHeaderLogo() {
  const G = new SvgG(LOGO.vb[2], LOGO.vb[3]);
  drawLogo(G, 0, 0, LOGO.vb[2] - 0, { colors: { ink: 'var(--fg)', gold: 'var(--accent)', gray: 'var(--muted)' } });
  $('#logo').innerHTML = G.toString('class="logo" preserveAspectRatio="xMinYMid meet"').replace(/ width="[^"]*" height="[^"]*"/, '').replace('<svg', '<svg style="width:100%;height:100%"');
}
function boot() {
  S = loadLocal() || newState();
  setUnit(S.unit || 'mm');
  const gp = $('#grip');
  let gd = null;
  gp.addEventListener('pointerdown', e => { gp.setPointerCapture(e.pointerId); gd = { y: e.clientY, h: $('#sheet').getBoundingClientRect().height, moved: false }; $('#sheet').classList.add('drag'); });
  gp.addEventListener('pointermove', e => { if (!gd) return; const dy = e.clientY - gd.y; if (Math.abs(dy) > 4) gd.moved = true; if (gd.moved) $('#sheet').style.height = Math.max(46, Math.min(sheetH('full'), gd.h - dy)) + 'px'; });
  const gend = () => {
    if (!gd) return; $('#sheet').classList.remove('drag');
    if (!gd.moved) setSheet(UI.sheet === 'min' ? 'peek' : 'min');
    else { const h = $('#sheet').getBoundingClientRect().height, c = ['min', 'peek', 'full'].map(k => [k, Math.abs(sheetH(k) - h)]).sort((a, b) => a[1] - b[1])[0][0]; setSheet(c); }
    gd = null;
  };
  gp.addEventListener('pointerup', gend); gp.addEventListener('pointercancel', gend);
  window.addEventListener('resize', applySheet);
  const st = stageEl();
  st.addEventListener('pointerdown', onDown);
  st.addEventListener('pointermove', onMove);
  st.addEventListener('pointerup', onUp);
  st.addEventListener('pointercancel', onUp);
  st.addEventListener('wheel', onWheel, { passive: false });
  $('#fit').onclick = () => { UI.uv = null; renderStage(); };
  $('#zin').onclick = () => { const v = curView(), r = stageRect(); const s = v.s * 1.3, cx = r.w / 2, cy = r.h / 2; const wx = (cx - v.ox) / v.s, wy = (v.oy - cy) / v.s; setUV(new View(s, cx - s * wx, cy + s * wy)); renderStage(); };
  $('#zout').onclick = () => { const v = curView(), r = stageRect(); const s = v.s / 1.3, cx = r.w / 2, cy = r.h / 2; const wx = (cx - v.ox) / v.s, wy = (v.oy - cy) / v.s; setUV(new View(s, cx - s * wx, cy + s * wy)); renderStage(); };
  document.querySelectorAll('.tab').forEach(t => { t.dataset.act = 'tab'; });
  $('#undo').dataset.act = 'undo'; $('#back').dataset.act = 'back';
  $('#conn').dataset.act = 'conectar'; renderBt();
  drawHeaderLogo();
  renderAll();
  if (window.ResizeObserver) new ResizeObserver(() => renderStage()).observe(st);
  window.addEventListener('resize', () => renderStage());
}
document.addEventListener('DOMContentLoaded', boot);
