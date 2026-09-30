// Modelo del plano, estado de sesión, historial y notificaciones.
//
// Formato del plano (JSON versionado):
//   { v, id, name, updatedAt, units:{perMeter,snap},
//     rooms:[{id,x,y,w,h,name}], items:[{id,type,x,y,c}],
//     circuits:[{id,name,color}], active }
// Unidades del mundo: 1 m = 40 u; snap 10 para ambientes y 5 para elementos.
import { t, tn } from './i18n.js';
import { SYMBOLS, SYMBOL_TYPES } from './symbols.js';

export const U = 40;
export const SNAP = 10;
export const ISNAP = 5;
export const HISTORY_MAX = 100;
export const PALETTE = ['#e08a00', '#1e6fff', '#12a150', '#d63a3a', '#8b5cf6', '#0ea5b7', '#d946a8', '#7a5c3e'];

export const uid = () => Math.random().toString(36).slice(2, 9);
export const snap = (v, n = SNAP) => Math.round(v / n) * n;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function newPlan(name = '') {
  return {
    v: 1, id: crypto.randomUUID ? crypto.randomUUID() : uid() + uid(), name,
    updatedAt: new Date().toISOString(),
    units: { perMeter: U, snap: SNAP },
    rooms: [], items: [],
    circuits: [
      { id: 'c1', name: t('circuit.lighting'), color: PALETTE[0] },
      { id: 'c2', name: t('circuit.sockets'), color: PALETTE[1] },
      { id: 'c3', name: t('circuit.kitchen'), color: PALETTE[2] },
      { id: 'c4', name: t('circuit.ac'), color: PALETTE[3] }
    ],
    active: 'c2'
  };
}

const num = v => (Number.isFinite(+v) ? +v : null);
const safeId = v => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);
const safeColor = (v, i) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : PALETTE[i % PALETTE.length]);

// Acepta el formato del prototipo (sin v/id/name/updatedAt) y completa lo que falta.
// Descarta lo que no sea válido: el JSON viene de afuera y termina en innerHTML.
export function normalize(d) {
  if (!d || !Array.isArray(d.rooms) || !Array.isArray(d.items) || !Array.isArray(d.circuits) || !d.circuits.length) return null;
  const p = newPlan(typeof d.name === 'string' ? d.name.slice(0, 80) : '');
  p.id = safeId(d.id) || p.id;
  if (typeof d.updatedAt === 'string' && !isNaN(Date.parse(d.updatedAt))) p.updatedAt = d.updatedAt;
  p.circuits = d.circuits.map((c, i) => ({
    id: safeId(c && c.id) || uid(),
    name: String((c && c.name) ?? '').slice(0, 60),
    color: safeColor(c && c.color, i)
  }));
  p.rooms = d.rooms.map(r => {
    const x = num(r && r.x), y = num(r && r.y), w = num(r && r.w), h = num(r && r.h);
    if ([x, y, w, h].includes(null)) return null;
    return { id: safeId(r.id) || uid(), x, y, w: Math.max(0, w), h: Math.max(0, h), name: String(r.name ?? '').slice(0, 60) };
  }).filter(Boolean);
  p.items = d.items.map(it => {
    const x = num(it && it.x), y = num(it && it.y);
    if (x === null || y === null || !SYMBOLS[it.type]) return null;
    const c = p.circuits.some(c => c.id === it.c) ? it.c : null;
    return { id: safeId(it.id) || uid(), type: it.type, x, y, c };
  }).filter(Boolean);
  p.active = p.circuits.some(c => c.id === d.active) ? d.active : p.circuits[0].id;
  return p;
}

/* ---------- estado ---------- */
let plan = newPlan();
export const getPlan = () => plan;
export const session = { tool: 'select', sel: null };   // sel: {kind:'room'|'item', id}

export const circuitOf = id => plan.circuits.find(c => c.id === id);
export const circuitIndex = id => plan.circuits.findIndex(c => c.id === id);

/* ---------- historial ---------- */
let undoStack = [];
let redoStack = [];
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

// Guardar el estado actual ANTES de mutar. Cualquier cambio nuevo invalida el rehacer.
export function checkpoint() {
  undoStack.push(JSON.stringify(plan));
  if (undoStack.length > HISTORY_MAX) undoStack.shift();
  redoStack = [];
}
// Descarta el último checkpoint (gesto cancelado sin cambios).
export function dropCheckpoint() { undoStack.pop(); }

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(plan));
  plan = JSON.parse(undoStack.pop());
  session.sel = null;
  notify('data');
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(plan));
  plan = JSON.parse(redoStack.pop());
  session.sel = null;
  notify('data');
}

// Abre otro plano: historial y selección propios.
export function setPlan(p) {
  plan = p;
  undoStack = []; redoStack = [];
  session.sel = null; session.tool = 'select';
  notify('load');
}
// Reemplaza el contenido del plano actual dejando el cambio deshacible.
export function replacePlan(p) {
  checkpoint();
  plan = p;
  session.sel = null;
  notify('data');
}

/* ---------- notificaciones ----------
   'canvas' : solo redibujar el plano (durante un arrastre)
   'soft'   : plano + chips + pista, guardando (tipeo: no se toca el input enfocado)
   'ui'     : todo, sin guardar (herramienta, selección)
   'data'   : todo, guardando
   'load'   : se abrió otro plano */
const listeners = new Set();
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function notify(kind = 'data') {
  if (kind === 'data' || kind === 'soft') plan.updatedAt = new Date().toISOString();
  listeners.forEach(fn => fn(kind));
}

export function setTool(tool) {
  session.tool = tool;
  if (tool !== 'select') session.sel = null;
  notify('ui');
}

/* ---------- resumen (leyenda) ----------
   Por circuito: cantidad de bocas por tipo de símbolo que se asigna a circuitos.
   Los símbolos sin circuito (tablero) van aparte en `other`. */
export function summarize(p = plan) {
  const types = SYMBOL_TYPES.filter(k => SYMBOLS[k].circuit);
  const blank = () => ({ counts: Object.fromEntries(types.map(k => [k, 0])), total: 0 });
  const rows = p.circuits.map((c, i) => ({ id: c.id, n: i + 1, name: c.name, color: c.color, ...blank() }));
  const orphan = blank();
  const other = {};
  for (const it of p.items) {
    const sym = SYMBOLS[it.type];
    if (!sym) continue;
    if (!sym.circuit) { other[it.type] = (other[it.type] || 0) + 1; continue; }
    const row = rows.find(r => r.id === it.c) || orphan;
    row.counts[it.type]++; row.total++;
  }
  const total = rows.reduce((a, r) => a + r.total, orphan.total);
  return { rows, orphan: orphan.total ? orphan : null, other, total };
}

// "3 luces · 2 llaves" (solo los tipos con cantidad)
export const countsText = counts =>
  Object.entries(counts).filter(([, n]) => n).map(([k, n]) => tn(`count.${k}`, n)).join(' · ') || '—';
