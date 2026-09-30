// Render SVG del plano, vista (pan/zoom/pinch) y entrada por puntero.
// Lo que pasa al tocar/arrastrar lo decide tools.js; acá solo se traducen los
// eventos a coordenadas del mundo y se maneja el desplazamiento y el zoom.
import { getPlan, session, circuitOf, circuitIndex, clamp, U } from './state.js';
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
  const { x, y } = it;
  const isSel = session.sel && session.sel.kind === 'item' && session.sel.id === it.id;
  const ring = isSel ? `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="var(--sel)" stroke-width="2" stroke-dasharray="4 3"/>` : '';
  const tag = (sym.circuit && c) ? `<text class="t-tag" x="${x}" y="${y + 22}">${t('circuit.short', { n: circuitIndex(it.c) + 1 })}</text>` : '';
  return `<g data-k="item" data-id="${it.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="20" fill="transparent"/>${ring}${drawSymbol(it, col)}${tag}</g>`;
}

const pointsAttr = pts => pts.map(q => q.join(',')).join(' ');

function cableMarkup(cb) {
  const c = circuitOf(cb.c), col = c ? c.color : '#5d6b78';
  const sel = session.sel && session.sel.kind === 'cable' && session.sel.id === cb.id;
  const pts = pointsAttr(cb.pts), cap = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
  let h = `<g data-k="cable" data-id="${cb.id}" style="cursor:pointer">` +
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
  const w = Math.max(24, l.text.length * 7.4 + 10), h = 20;
  const isSel = session.sel && session.sel.kind === 'label' && session.sel.id === l.id;
  const box = `<rect x="${l.x - w / 2}" y="${l.y - h / 2}" width="${w}" height="${h}" rx="4" fill="transparent"${isSel ? ' stroke="var(--sel)" stroke-width="1.5" stroke-dasharray="4 3"' : ''}/>`;
  return `<g data-k="label" data-id="${l.id}" style="cursor:pointer"${l.rot ? ` transform="rotate(${l.rot} ${l.x} ${l.y})"` : ''}>${box}` +
    `<text class="t-label" x="${l.x}" y="${l.y + 4.5}">${esc(l.text)}</text></g>`;
}

export function renderCanvas() {
  const plan = getPlan();
  let h = '';
  for (const r of plan.rooms) {
    const isSel = session.sel && session.sel.kind === 'room' && session.sel.id === r.id;
    h += `<g>
      <rect data-k="room" data-id="${r.id}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
        fill="var(--room)" stroke="${isSel ? 'var(--sel)' : 'var(--wall)'}" stroke-width="${isSel ? 3.5 : 3}" style="cursor:${session.tool === 'select' ? 'move' : 'crosshair'}"/>
      <text class="t-name" x="${r.x + r.w / 2}" y="${r.y + r.h / 2 - 2}">${esc(r.name)}</text>
      <text class="t-size" x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 12}">${fmtNum(r.w / U)} × ${fmtNum(r.h / U)} m</text>
      ${isSel && session.tool === 'select' ? `<g data-k="handle" data-id="${r.id}" style="cursor:nwse-resize"><circle cx="${r.x + r.w}" cy="${r.y + r.h}" r="22" fill="transparent"/><circle cx="${r.x + r.w}" cy="${r.y + r.h}" r="10" fill="var(--sel)" stroke="#fff" stroke-width="2"/></g>` : ''}
    </g>`;
  }
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
