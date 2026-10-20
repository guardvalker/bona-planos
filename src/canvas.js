// Render SVG del plano, vista (pan/zoom/pinch) y entrada por puntero.
// Lo que pasa al tocar/arrastrar lo decide tools.js; acá solo se traducen los
// eventos a coordenadas del mundo y se maneja el desplazamiento y el zoom.
import { getPlan, session, circuitOf, circuitIndex, clamp, U, polyInfo, isRect, bbox } from './state.js';
import { SYMBOLS, drawSymbol } from './symbols.js';
import { t, fmtNum } from './i18n.js';

const $ = s => document.querySelector(s);
let svg, world, scene, handlers;
export const view = { x: 30, y: 30, s: 1 };
const pointers = new Map();
let pinch = null;
let drag = null;

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- vista ---------- */
function applyView() { world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.s})`); }
function toWorld(e) {
  const r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.x) / view.s, y: (e.clientY - r.top - view.y) / view.s };
}
function zoomAt(cx, cy, ns) {
  ns = clamp(ns, .3, 4);
  const wx = (cx - view.x) / view.s, wy = (cy - view.y) / view.s;
  view.s = ns; view.x = cx - wx * ns; view.y = cy - wy * ns;
  applyView();
}
export function zoomBy(f) {
  const r = svg.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, view.s * f);
}
export function resetView() { view.x = 30; view.y = 30; view.s = 1; applyView(); }

/* ---------- render ---------- */
function symbolMarkup(it) {
  const sym = SYMBOLS[it.type];
  const c = circuitOf(it.c);
  const col = c ? c.color : '#5d6b78';
  const { x, y } = it, k = it.s || 1;
  const isSel = session.sel && session.sel.kind === 'item' && session.sel.id === it.id;
  const ring = isSel ? `<circle cx="${x}" cy="${y}" r="${17 * k}" fill="none" stroke="var(--sel)" stroke-width="2" stroke-dasharray="4 3"/>` : '';
  const tag = (sym.circuit && c) ? `<text class="t-tag" x="${x}" y="${y + 22 * k}" style="font-size:${Math.max(7, 10 * k)}px">${t('circuit.short', { n: circuitIndex(it.c) + 1 })}</text>` : '';
  return `<g data-k="item" data-id="${it.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${Math.max(12, 20 * k)}" fill="transparent"/>${ring}${drawSymbol(it, col)}${tag}</g>`;
}

const pointsAttr = pts => pts.map(q => q.join(',')).join(' ');

function cableMarkup(cb) {
  const c = circuitOf(cb.c), col = c ? c.color : '#5d6b78';
  const sel = session.sel && session.sel.kind === 'cable' && session.sel.id === cb.id;
  const pts = pointsAttr(cb.pts), cap = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const op = sel ? 1 : 1 - ((c && c.fade) || 0);                      // el cable seleccionado se ve entero
  let h = `<g data-k="cable" data-id="${cb.id}" style="cursor:pointer"${op < 1 ? ` opacity="${op}"` : ''}>` +
    `<polyline points="${pts}" stroke="transparent" stroke-width="22" ${cap}/>` +
    `<polyline points="${pts}" stroke="var(--room)" stroke-width="${sel ? 8 : 6}" opacity=".9" ${cap}/>` +
    `<polyline points="${pts}" stroke="${col}" stroke-width="3.5" stroke-dasharray="9 5" ${cap}/></g>`;
  if (session.draft && session.draft.id === cb.id) {
    // en trazado: puntos chicos, sin interacción
    h += cb.pts.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="4.5" fill="var(--room)" stroke="${col}" stroke-width="2" pointer-events="none"/>`).join('');
  } else if (sel && session.tool === 'select') {
    for (let i = 0; i < cb.pts.length - 1; i++) {                       // "+" en el medio de cada tramo largo
      const a = cb.pts[i], b = cb.pts[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 30) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      h += `<g data-k="midpt" data-id="${cb.id}" data-i="${i}" style="cursor:copy"><circle cx="${mx}" cy="${my}" r="14" fill="transparent"/>` +
        `<circle cx="${mx}" cy="${my}" r="7" fill="var(--sel)" opacity=".85"/><path d="M${mx - 3.5} ${my}h7M${mx} ${my - 3.5}v7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>`;
    }
    h += cb.pts.map((q, i) => {
      const on = session.sel.vi === i;
      return `<g data-k="vertex" data-id="${cb.id}" data-i="${i}" style="cursor:move"><circle cx="${q[0]}" cy="${q[1]}" r="15" fill="transparent"/>` +
        `<circle cx="${q[0]}" cy="${q[1]}" r="6.5" fill="${on ? 'var(--sel)' : 'var(--room)'}" stroke="var(--sel)" stroke-width="2.5"/></g>`;
    }).join('');
  }
  return h;
}

function labelMarkup(l) {
  const k = l.s || 1, w = Math.max(24, l.text.length * 7.4 * k + 10), h = 20 * k;
  const isSel = session.sel && session.sel.kind === 'label' && session.sel.id === l.id;
  const box = `<rect x="${l.x - w / 2}" y="${l.y - h / 2}" width="${w}" height="${h}" rx="4" fill="transparent"${isSel ? ' stroke="var(--sel)" stroke-width="1.5" stroke-dasharray="4 3"' : ''}/>`;
  return `<g data-k="label" data-id="${l.id}" style="cursor:pointer"${l.rot ? ` transform="rotate(${l.rot} ${l.x} ${l.y})"` : ''}>${box}` +
    `<text class="t-label" x="${l.x}" y="${l.y + 4.5 * k}" style="font-size:${13 * k}px">${esc(l.text)}</text></g>`;
}

// Zona: recuadro punteado de color. Solo el borde y el nombre reciben toques, así no tapa lo que hay debajo.
function zoneMarkup(z) {
  const isSel = session.sel && session.sel.kind === 'zone' && session.sel.id === z.id;
  const col = z.color, small = z.w < 60 || z.h < 30;
  return `<g data-k="zone" data-id="${z.id}" style="cursor:${session.tool === 'select' ? 'move' : 'crosshair'}">
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${col}" fill-opacity=".1" pointer-events="none"/>
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke"/>
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="${col}" stroke-width="${isSel ? 4 : 3}" stroke-dasharray="10 6" pointer-events="none"/>
    ${z.name ? `<text class="t-zone" x="${z.x + 6}" y="${z.y + (small ? -6 : 15)}" fill="${col}">${esc(z.name)}</text>` : ''}
  </g>` + (isSel && session.tool === 'select'
    ? `<g data-k="zhandle" data-id="${z.id}" style="cursor:nwse-resize"><circle cx="${z.x + z.w}" cy="${z.y + z.h}" r="22" fill="transparent"/><circle cx="${z.x + z.w}" cy="${z.y + z.h}" r="10" fill="var(--sel)" stroke="#fff" stroke-width="2"/></g>` : '');
}

const node = (k, id, i, x, y, on) =>
  `<g data-k="${k}" data-id="${id}" data-i="${i}" style="cursor:move"><circle cx="${x}" cy="${y}" r="16" fill="transparent"/>` +
  `<circle cx="${x}" cy="${y}" r="7" fill="${on ? 'var(--sel)' : '#fff'}" stroke="var(--sel)" stroke-width="2.5"/></g>`;

// Medida de un tramo: texto a un costado (hacia afuera del centro dado) con halo, sin recibir toques.
function dimMarkup(a, b, cx, cy) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 10) return '';
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  let nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
  return `<text class="t-dim" x="${mx + nx * 18}" y="${my + ny * 18 + 4}">${fmtNum(Math.round(len / U * 100) / 100)} m</text>`;
}

function roomMarkup(r) {
  const isSel = session.sel && session.sel.kind === 'room' && session.sel.id === r.id;
  const info = polyInfo(r.pts), b = bbox(r.pts);
  const size = isRect(r.pts) ? `${fmtNum(b.w / U)} × ${fmtNum(b.h / U)} m` : `${fmtNum(Math.round(info.area / (U * U) * 10) / 10)} m²`;
  let h = `<g>
    <polygon data-k="room" data-id="${r.id}" points="${pointsAttr(r.pts)}" stroke-linejoin="round"
      fill="var(--room)" stroke="${isSel ? 'var(--sel)' : 'var(--wall)'}" stroke-width="${isSel ? 3.5 : 3}" style="cursor:${session.tool === 'select' ? 'move' : 'crosshair'}"/>
    <text class="t-name" x="${info.cx}" y="${info.cy - 2}">${esc(r.name)}</text>
    <text class="t-size" x="${info.cx}" y="${info.cy + 12}">${size}</text>`;
  if (isSel) h += r.pts.map((q, i) => dimMarkup(q, r.pts[(i + 1) % r.pts.length], info.cx, info.cy)).join('');
  if (isSel && session.tool === 'select') {
    const n = r.pts.length;
    for (let i = 0; i < n; i++) {                                   // "+" en el medio de cada pared larga
      const a = r.pts[i], c = r.pts[(i + 1) % n];
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 30) continue;
      const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
      h += `<g data-k="rmid" data-id="${r.id}" data-i="${i}" style="cursor:copy"><circle cx="${mx}" cy="${my}" r="14" fill="transparent"/>` +
        `<circle cx="${mx}" cy="${my}" r="7" fill="var(--sel)" opacity=".85"/><path d="M${mx - 3.5} ${my}h7M${mx} ${my - 3.5}v7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>`;
    }
    h += r.pts.map((q, i) => node('rvertex', r.id, i, q[0], q[1], session.sel.vi === i)).join('');
  }
  return h + '</g>';
}

// Pared suelta (media pared, tabique): línea gruesa con el mismo trazo que los ambientes.
function wallMarkup(w) {
  const isSel = session.sel && session.sel.kind === 'wall' && session.sel.id === w.id;
  const pts = pointsAttr(w.pts);
  let h = `<g data-k="wall" data-id="${w.id}" style="cursor:${session.tool === 'select' ? 'move' : 'crosshair'}">` +
    `<polyline points="${pts}" stroke="transparent" stroke-width="22" fill="none" stroke-linecap="round"/>` +
    `<polyline points="${pts}" stroke="${isSel ? 'var(--sel)' : 'var(--wall)'}" stroke-width="${isSel ? 5 : 4}" fill="none" stroke-linecap="square"/></g>`;
  if (isSel) h += dimMarkup(w.pts[0], w.pts[1], (w.pts[0][0] + w.pts[1][0]) / 2 + 1e-3, (w.pts[0][1] + w.pts[1][1]) / 2 - 1e-3);
  if (isSel && session.tool === 'select') h += w.pts.map((q, i) => node('wvertex', w.id, i, q[0], q[1], false)).join('');
  return h;
}

export function renderCanvas() {
  const plan = getPlan();
  let h = '';
  for (const r of plan.rooms) h += roomMarkup(r);
  for (const w of plan.walls) h += wallMarkup(w);
  for (const z of plan.zones) h += zoneMarkup(z);
  for (const cb of plan.cables) h += cableMarkup(cb);
  for (const it of plan.items) if (SYMBOLS[it.type]) h += symbolMarkup(it);
  for (const l of plan.labels) h += labelMarkup(l);
  scene.innerHTML = h;
}

/* ---------- entrada ---------- */
function down(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);

  if (pointers.size === 2) {
    // segundo dedo: cancelar el gesto en curso y pasar a pinch
    if (drag && drag.type !== 'pan' && !drag.panning) handlers.cancel(drag);
    drag = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
    return;
  }
  if (pointers.size > 2) return;

  const el = e.target.closest ? e.target.closest('[data-k]') : null;
  const hit = el ? { k: el.dataset.k, id: el.dataset.id, i: el.dataset.i } : null;
  drag = handlers.down(toWorld(e), hit, e) || { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  // gesto "toque": si el dedo se mueve más de 10 px pasa a ser desplazamiento del plano
  if (drag.tap) { drag.sx = e.clientX; drag.sy = e.clientY; drag.vx = view.x; drag.vy = view.y; }
}

function move(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const r = svg.getBoundingClientRect();
    zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
    return;
  }
  if (!drag) return;
  if (drag.tap && !drag.panning && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.panning = true;
  if (drag.type === 'pan' || drag.panning) {
    view.x = drag.vx + (e.clientX - drag.sx);
    view.y = drag.vy + (e.clientY - drag.sy);
    applyView();
  } else handlers.move(drag, toWorld(e));
}

function up(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.type !== 'pan' && !d.panning) handlers.up(d);
}

export function initCanvas(h) {
  handlers = h;
  svg = $('#cv'); world = $('#world'); scene = $('#scene');
  svg.setAttribute('aria-label', t('canvas.label'));
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, view.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  applyView();
}
