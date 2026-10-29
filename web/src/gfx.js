/* ===== Tégora · gráficos: um único desenho, duas saídas (SVG na tela, PDF vetorial) ===== */
'use strict';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = x => Math.round(x * 100) / 100;

/* larguras da Helvetica (unidades de 1/1000 em), caracteres 32 a 126 */
const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
function textW(s, size, o) {
  o = o || {};
  let w = 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c > 126 || c < 32) {
      const b = s[i].normalize('NFD')[0];
      c = b ? b.charCodeAt(0) : 63;
      if (c > 126 || c < 32) c = 63;
    }
    w += HW[c - 32];
  }
  let k = 1;
  if (o.font === 'serif') k = 0.9;
  if (o.bold) k *= 1.06;
  if (o.font === 'mono') k *= 1.05;
  return w * size * k / 1000;
}

const FONTVAR = { sans: 'var(--f-sans)', serif: 'var(--f-serif)', mono: 'var(--f-mono)' };

/* Todas as primitivas usam coordenadas de dispositivo, com y para baixo. */
class SvgG {
  constructor(w, h) { this.w = w; this.h = h; this.o = []; this.cn = 0; this.hit = true; this.pre = 'c' + Math.random().toString(36).slice(2, 6); }
  _st(o) {
    const a = ['fill:' + (o.fill || 'none')];
    if (o.stroke && o.stroke !== 'none') {
      a.push('stroke:' + o.stroke, 'stroke-width:' + r2(o.w || 1));
      if (o.dash) a.push('stroke-dasharray:' + o.dash.map(r2).join(' '));
    } else a.push('stroke:none');
    if (o.pe) a.push('pointer-events:' + o.pe);
    return ' style="' + a.join(';') + '"';
  }
  _id(o) { return o.id ? ' data-id="' + esc(o.id) + '"' : ''; }
  line(x1, y1, x2, y2, o) {
    o = o || {};
    this.o.push(`<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"${this._st(o)}${this._id(o)}/>`);
  }
  rect(x, y, w, h, o) {
    o = o || {};
    this.o.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"${o.r ? ` rx="${r2(o.r)}"` : ''}${this._st(o)}${this._id(o)}/>`);
  }
  poly(pts, o) {
    o = o || {};
    const p = pts.map(q => r2(q[0]) + ',' + r2(q[1])).join(' ');
    this.o.push(`<${o.close === false ? 'polyline' : 'polygon'} points="${p}"${o.eo ? ' fill-rule="evenodd"' : ''}${this._st(o)}${this._id(o)}/>`);
  }
  circle(cx, cy, r, o) {
    o = o || {};
    this.o.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}"${this._st(o)}${this._id(o)}/>`);
  }
  text(x, y, s, o) {
    o = o || {};
    const size = o.size || 10;
    const anchor = o.anchor || 'middle';
    const tr = o.rot ? ` transform="rotate(${r2(o.rot)} ${r2(x)} ${r2(y)})"` : '';
    const st = `fill:${o.fill || '#000'};font-family:${FONTVAR[o.font || 'sans']};font-size:${r2(size)}px;font-weight:${o.bold ? 600 : 400};text-anchor:${anchor};pointer-events:none;stroke:none` + (o.italic ? ';font-style:italic' : '');
    this.o.push(`<text x="${r2(x)}" y="${r2(y)}" dy="${r2(size * 0.35)}"${tr} style="${st}">${esc(s)}</text>`);
  }
  path(d, m, o) {
    o = o || {};
    this.o.push(`<path d="${d}" transform="matrix(${m.map(r2).join(' ')})" style="fill:${o.fill || '#000'};stroke:none"/>`);
  }
  image(x, y, w, h, ref) {
    const ph = (typeof PHOTOS !== 'undefined') && PHOTOS[ref];
    if (!ph) { this.rect(x, y, w, h, { fill: '#888' }); return; }
    this.o.push(`<image href="${ph.url}" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="none"/>`);
  }
  clipPoly(pts) {
    const id = this.pre + (++this.cn);
    this.o.push(`<clipPath id="${id}"><polygon points="${pts.map(q => r2(q[0]) + ',' + r2(q[1])).join(' ')}"/></clipPath><g clip-path="url(#${id})">`);
  }
  clipRect(x, y, w, h) { this.clipPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  unclip() { this.o.push('</g>'); }
  hitLine(x1, y1, x2, y2, id, w) {
    this.o.push(`<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" style="stroke:rgba(0,0,0,0.001);stroke-width:${w};fill:none;pointer-events:stroke" data-id="${esc(id)}"/>`);
  }
  hitRect(x, y, w, h, id) {
    this.o.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" style="fill:rgba(0,0,0,0.001);stroke:none;pointer-events:all" data-id="${esc(id)}"/>`);
  }
  toString(extra) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(this.w)} ${r2(this.h)}" width="${r2(this.w)}" height="${r2(this.h)}" ${extra || ''}>${this.o.join('')}</svg>`;
  }
}

/* ---------- PDF vetorial escrito à mão (fontes padrão, sem dependências) ---------- */
function hexRGB(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c || '');
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
const CP1252 = { 0x2212: 0x2D, 0x2013: 0x96, 0x2014: 0x97, 0x2022: 0x95, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x20AC: 0x80 };
function pdfStr(s) {
  let o = '';
  for (const ch of String(s)) {
    let c = ch.codePointAt(0);
    if (c === 0x2248) c = 0x7E;           /* ≈ vira ~ */
    if (CP1252[c]) c = CP1252[c];
    if (c > 255) c = 63;
    if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
    else if (c < 32 || c > 126) o += '\\' + ('00' + c.toString(8)).slice(-3);
    else o += String.fromCharCode(c);
  }
  return o;
}
const pn = x => (Math.round(x * 100) / 100).toString();

class PdfG {
  constructor(doc, w, h) { this.doc = doc; this.w = w; this.h = h; this.c = []; this.imgs = []; this.hit = false; }
  Y(y) { return this.h - y; }
  _paint(o, canFill) {
    const f = canFill && o.fill && o.fill !== 'none', s = o.stroke && o.stroke !== 'none';
    let pre = '';
    if (f) pre += hexRGB(o.fill).map(pn).join(' ') + ' rg ';
    if (s) {
      pre += hexRGB(o.stroke).map(pn).join(' ') + ' RG ' + pn(o.w || 1) + ' w ';
      if (o.dash) pre += '[' + o.dash.map(pn).join(' ') + '] 0 d ';
    }
    const op = f && s ? (o.eo ? 'B*' : 'B') : f ? (o.eo ? 'f*' : 'f') : s ? 'S' : 'n';
    return [pre, op];
  }
  _emit(pre, body, op) { this.c.push('q 1 J 1 j ' + pre + body + ' ' + op + ' Q'); }
  line(x1, y1, x2, y2, o) {
    o = o || {};
    const [pre, op] = this._paint(o, false);
    if (op === 'n') return;
    this._emit(pre, `${pn(x1)} ${pn(this.Y(y1))} m ${pn(x2)} ${pn(this.Y(y2))} l`, op);
  }
  rect(x, y, w, h, o) {
    o = o || {};
    const [pre, op] = this._paint(o, true);
    if (o.r && o.r > 0.5) { this.poly(roundRectPts(x, y, w, h, o.r), o); return; }
    this._emit(pre, `${pn(x)} ${pn(this.Y(y + h))} ${pn(w)} ${pn(h)} re`, op);
  }
  poly(pts, o) {
    o = o || {};
    const [pre, op] = this._paint(o, o.close !== false);
    let b = pts.map((p, i) => `${pn(p[0])} ${pn(this.Y(p[1]))} ${i ? 'l' : 'm'}`).join(' ');
    if (o.close !== false) b += ' h';
    const op2 = o.close === false ? (op === 'f' || op === 'f*' ? 'n' : op) : op;
    this._emit(pre, b, op2);
  }
  circle(cx, cy, r, o) {
    o = o || {};
    const [pre, op] = this._paint(o, true);
    const k = 0.5523 * r, y = this.Y(cy);
    const b = `${pn(cx + r)} ${pn(y)} m ${pn(cx + r)} ${pn(y + k)} ${pn(cx + k)} ${pn(y + r)} ${pn(cx)} ${pn(y + r)} c ` +
      `${pn(cx - k)} ${pn(y + r)} ${pn(cx - r)} ${pn(y + k)} ${pn(cx - r)} ${pn(y)} c ` +
      `${pn(cx - r)} ${pn(y - k)} ${pn(cx - k)} ${pn(y - r)} ${pn(cx)} ${pn(y - r)} c ` +
      `${pn(cx + k)} ${pn(y - r)} ${pn(cx + r)} ${pn(y - k)} ${pn(cx + r)} ${pn(y)} c h`;
    this._emit(pre, b, op);
  }
  text(x, y, s, o) {
    o = o || {};
    const size = o.size || 10;
    const bold = !!o.bold;
    const font = o.font === 'serif' ? (bold ? 'F4' : 'F3') : (bold ? 'F2' : 'F1');
    const w = textW(s, size, o);
    const shift = o.anchor === 'start' ? 0 : o.anchor === 'end' ? -w : -w / 2;
    const th = (o.rot || 0) * Math.PI / 180;
    const t = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)];
    const bx = x + shift * t[0] + 0.35 * size * n[0], by = y + shift * t[1] + 0.35 * size * n[1];
    const c = Math.cos(-th), sn = Math.sin(-th);
    const col = hexRGB(o.fill || '#000000').map(pn).join(' ');
    this.c.push(`q ${col} rg BT /${font} ${pn(size)} Tf ${pn(c)} ${pn(sn)} ${pn(-sn)} ${pn(c)} ${pn(bx)} ${pn(this.Y(by))} Tm (${pdfStr(s)}) Tj ET Q`);
  }
  path(d, m, o) {
    o = o || {};
    const cmds = parseSvgPath(d);
    let out = '', cx = 0, cy = 0, sx = 0, sy = 0;
    const T = (x, y) => { const X = m[0] * x + m[2] * y + m[4], Yv = m[1] * x + m[3] * y + m[5]; return pn(X) + ' ' + pn(this.Y(Yv)); };
    for (const c of cmds) {
      const a = c.a;
      if (c.t === 'M') { cx = a[0]; cy = a[1]; sx = cx; sy = cy; out += T(cx, cy) + ' m '; }
      else if (c.t === 'L') { cx = a[0]; cy = a[1]; out += T(cx, cy) + ' l '; }
      else if (c.t === 'H') { cx = a[0]; out += T(cx, cy) + ' l '; }
      else if (c.t === 'V') { cy = a[0]; out += T(cx, cy) + ' l '; }
      else if (c.t === 'Q') {
        const q1 = [a[0], a[1]], p = [a[2], a[3]];
        const c1 = [cx + 2 / 3 * (q1[0] - cx), cy + 2 / 3 * (q1[1] - cy)];
        const c2 = [p[0] + 2 / 3 * (q1[0] - p[0]), p[1] + 2 / 3 * (q1[1] - p[1])];
        out += T(c1[0], c1[1]) + ' ' + T(c2[0], c2[1]) + ' ' + T(p[0], p[1]) + ' c ';
        cx = p[0]; cy = p[1];
      } else if (c.t === 'Z') { out += 'h '; cx = sx; cy = sy; }
    }
    this.c.push(`q ${hexRGB(o.fill || '#000000').map(pn).join(' ')} rg ${out}f Q`);
  }
  image(x, y, w, h, ref) {
    const idx = this.doc.imgIndex[ref];
    if (idx == null) { this.rect(x, y, w, h, { fill: '#BBBBBB' }); return; }
    if (this.imgs.indexOf(idx) < 0) this.imgs.push(idx);
    this.c.push(`q ${pn(w)} 0 0 ${pn(h)} ${pn(x)} ${pn(this.Y(y + h))} cm /Im${idx} Do Q`);
  }
  clipPoly(pts) {
    this.c.push('q ' + pts.map((p, i) => `${pn(p[0])} ${pn(this.Y(p[1]))} ${i ? 'l' : 'm'}`).join(' ') + ' h W n');
  }
  clipRect(x, y, w, h) { this.clipPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  unclip() { this.c.push('Q'); }
  hitLine() { } hitRect() { }
}
function roundRectPts(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + i * Math.PI / 8; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return pts;
}

function parseSvgPath(d) {
  const re = /([MLHVQZmlhvqz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  const toks = []; let m;
  while ((m = re.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
  const need = { M: 2, L: 2, H: 1, V: 1, Q: 4, Z: 0 };
  const out = []; let i = 0, cmd = null;
  while (i < toks.length) {
    if (typeof toks[i] === 'string') { cmd = toks[i++]; if (cmd === 'Z' || cmd === 'z') { out.push({ t: 'Z', a: [] }); } continue; }
    const n = need[cmd];
    out.push({ t: cmd, a: toks.slice(i, i + n) });
    i += n;
    if (cmd === 'M') cmd = 'L';
  }
  return out;
}

class PdfDoc {
  constructor() { this.pages = []; this.images = []; this.imgIndex = {}; }
  addImage(ref, bytes, w, h) { this.imgIndex[ref] = this.images.length; this.images.push({ bytes, w, h }); }
  addPage(w, h) { const g = new PdfG(this, w, h); this.pages.push(g); return g; }
  build(title) {
    const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    const chunks = []; let pos = 0; const offs = [];
    const push = b => { if (typeof b === 'string') b = enc(b); chunks.push(b); pos += b.length; };
    const nImg = this.images.length, nP = this.pages.length;
    const firstImg = 7, firstPage = firstImg + nImg;
    const objNo = k => firstPage + k * 2;
    push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    const beginObj = n => { offs[n] = pos; push(n + ' 0 obj\n'); };
    beginObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    beginObj(2); push('<< /Type /Pages /Count ' + nP + ' /Kids [' + this.pages.map((_, k) => (objNo(k) + 1) + ' 0 R').join(' ') + '] >>\nendobj\n');
    [['Helvetica', 3], ['Helvetica-Bold', 4], ['Times-Roman', 5], ['Times-Bold', 6]].forEach(f => {
      beginObj(f[1]); push('<< /Type /Font /Subtype /Type1 /BaseFont /' + f[0] + ' /Encoding /WinAnsiEncoding >>\nendobj\n');
    });
    this.images.forEach((im, i) => {
      beginObj(firstImg + i);
      push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
      push(im.bytes); push('\nendstream\nendobj\n');
    });
    this.pages.forEach((pg, k) => {
      const cs = pg.c.join('\n');
      beginObj(objNo(k)); push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
      const xo = pg.imgs.map(i => `/Im${i} ${firstImg + i} 0 R`).join(' ');
      beginObj(objNo(k) + 1);
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pn(pg.w)} ${pn(pg.h)}] /Contents ${objNo(k)} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >>${xo ? ' /XObject << ' + xo + ' >>' : ''} >> >>\nendobj\n`);
    });
    const infoNo = firstPage + nP * 2;
    beginObj(infoNo); push('<< /Title (' + pdfStr(title || 'Tégora') + ') /Producer (Tégora Conferência) >>\nendobj\n');
    const xref = pos, total = infoNo + 1;
    let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (let n = 1; n < total; n++) x += ('0000000000' + offs[n]).slice(-10) + ' 00000 n \n';
    push(x); push(`trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoNo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(pos); let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }
}

/* ---------- utilidades de arquivo ---------- */
function b64ToBytes(b64) {
  if (typeof atob === 'function') { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
const CRCT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : new Uint8Array(Buffer.from(s, 'utf8')); }
/* ZIP sem compressão (o visualizador só deixa salvar certas extensões; o DXF segue dentro de um .zip) */
function makeZip(files) {
  const parts = [], cen = []; let off = 0;
  const u16 = n => [n & 255, n >> 8 & 255], u32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
  for (const f of files) {
    const nm = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data);
    const lh = new Uint8Array([0x50, 0x4B, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nm.length), 0, 0]);
    parts.push(lh, nm, data);
    cen.push({ nm, crc, size: data.length, off });
    off += lh.length + nm.length + data.length;
  }
  const cdStart = off;
  for (const c of cen) {
    const h = new Uint8Array([0x50, 0x4B, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c.crc), ...u32(c.size), ...u32(c.size), ...u16(c.nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(c.off)]);
    parts.push(h, c.nm); off += h.length + c.nm.length;
  }
  const end = new Uint8Array([0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(cen.length), ...u16(cen.length), ...u32(off - cdStart), ...u32(cdStart), 0, 0]);
  parts.push(end);
  const tot = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(tot); let p = 0;
  for (const x of parts) { out.set(x, p); p += x.length; }
  return out;
}
