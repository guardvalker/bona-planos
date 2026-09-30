// Render SVG del plano, vista (pan/zoom/pinch) y entrada por puntero.
// Lo que pasa al tocar/arrastrar lo decide tools.js; acá solo se traducen los
// eventos a coordenadas del mundo y se maneja el desplazamiento y el zoom.
import { getPlan, session, circuitOf, circuitIndex, clamp, U } from './state.js';
import { SYMBOLS } from './symbols.js';
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
  const tag = (sym.circuit && c) ? `<text class="t-tag" x="${x}" y="${y + 22}" fill="${col}">${t('circuit.short', { n: circuitIndex(it.c) + 1 })}</text>` : '';
  return `<g data-k="item" data-id="${it.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="17" fill="transparent"/>${ring}${sym.draw(x, y, col)}${tag}</g>`;
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
      ${isSel && session.tool === 'select' ? `<circle data-k="handle" data-id="${r.id}" cx="${r.x + r.w}" cy="${r.y + r.h}" r="10" fill="var(--sel)" stroke="#fff" stroke-width="2" style="cursor:nwse-resize"/>` : ''}
    </g>`;
  }
  for (const it of plan.items) if (SYMBOLS[it.type]) h += symbolMarkup(it);
  scene.innerHTML = h;
}

/* ---------- entrada ---------- */
function down(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);

  if (pointers.size === 2) {
    // segundo dedo: cancelar el gesto en curso y pasar a pinch
    if (drag && drag.type !== 'pan') handlers.cancel(drag);
    drag = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
    return;
  }
  if (pointers.size > 2) return;

  const el = e.target.closest ? e.target.closest('[data-k]') : null;
  const hit = el ? { k: el.dataset.k, id: el.dataset.id } : null;
  drag = handlers.down(toWorld(e), hit) || { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
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
  if (drag.type === 'pan') {
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
  if (d.type !== 'pan') handlers.up(d);
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
