// Modelo del plano, estado de sesión, historial y notificaciones.
//
// Formato del plano (JSON versionado):
//   { v, id, name, updatedAt, units:{perMeter,snap},
//     rooms:[{id,pts:[[x,y],...],name}],    polígono (esquinas = nodos); los v1–v3 traían x,y,w,h y se convierten
//     walls:[{id,pts:[[x,y],[x,y]]}],       paredes sueltas (medias paredes, tabiques) dentro de un ambiente
//     items:[{id,type,x,y,c,rot,s}],        s: escala (1 = normal)          type: clave de SYMBOLS; rot: 0|90|180|270
//     zones:[{id,x,y,w,h,name,color}],      recuadros punteados de color (horno, mostrador, etc.), sin circuito
//     labels:[{id,x,y,text,rot,s}],           texto libre sobre el plano
//     cables:[{id,c,pts:[[x,y],...]}],      recorrido aproximado de los conductores (c: circuito)
//     circuits:[{id,name,color,prot,cable,rcd,notes,fade}],   fade: 0–.8, qué tanto se transparentan sus cables (0 = opacos)   datos técnicos opcionales (texto libre)
//     active, iscale, lscale }          escala con la que nacen los elementos / etiquetas nuevos
// v1/v2 (sin cables, labels, rot ni datos técnicos) y el formato del prototipo se siguen aceptando.
// Unidades del mundo: 1 m = 40 u; snap 10 para ambientes y 5 para elementos.
import { t, tn, fmtNum } from './i18n.js';
import { SYMBOLS, SYMBOL_TYPES } from './symbols.js';

export const U = 40;
export const SNAP = 10;
export const ISNAP = 5;
export const HISTORY_MAX = 100;
export const PALETTE = ['#e08a00', '#1e6fff', '#12a150', '#d63a3a', '#8b5cf6', '#0ea5b7', '#d946a8', '#7a5c3e'];

export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function bbox(pts) {
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// Área con signo (shoelace) y centroide; si el polígono es degenerado devuelve el centro del bbox.
export function polyInfo(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  const b = bbox(pts);
  if (Math.abs(a) < 1e-6) return { area: 0, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
  return { area: Math.abs(a) / 2, cx: cx / (3 * a), cy: cy / (3 * a) };
}
export function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// ¿Es un rectángulo alineado a los ejes? (para mostrar "ancho × alto" en vez de m²)
export const isRect = pts => pts.length === 4 && pts.every((q, i) => {
  const n = pts[(i + 1) % 4];
  return q[0] === n[0] || q[1] === n[1];
});

export const SCALE_MIN = .4, SCALE_MAX = 2.5;
export const safeScale = v => (Number.isFinite(+v) && +v > 0 ? Math.round(clamp(+v, SCALE_MIN, SCALE_MAX) * 100) / 100 : 1);

export const safeFade = v => (Number.isFinite(+v) ? Math.round(clamp(+v, 0, .8) * 10) / 10 : 0);

export const uid = () => Math.random().toString(36).slice(2, 9);
export const snap = (v, n = SNAP) => Math.round(v / n) * n;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function newPlan(name = '') {
  return {
    v: 4, id: crypto.randomUUID ? crypto.randomUUID() : uid() + uid(), name,
    updatedAt: new Date().toISOString(),
    units: { perMeter: U, snap: SNAP },
    rooms: [], walls: [], items: [], labels: [], cables: [], zones: [],
    circuits: [
      { id: 'c1', name: t('circuit.lighting'), color: PALETTE[0] },
      { id: 'c2', name: t('circuit.sockets'), color: PALETTE[1] },
      { id: 'c3', name: t('circuit.kitchen'), color: PALETTE[2] },
      { id: 'c4', name: t('circuit.ac'), color: PALETTE[3] }
    ],
    active: 'c2', iscale: 1, lscale: 1
  };
}

const num = v => (Number.isFinite(+v) ? +v : null);
const safeId = v => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const safeRot = v => ([90, 180, 270].includes(+v) ? +v : 0);
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
    color: safeColor(c && c.color, i),
    fade: safeFade(c && c.fade), prot: str(c && c.prot, 60), cable: str(c && c.cable, 60), rcd: str(c && c.rcd, 60), notes: str(c && c.notes, 200)
  }));
  p.rooms = d.rooms.map(r => {
    let pts = (Array.isArray(r && r.pts) ? r.pts : []).slice(0, 100)
      .map(q => (Array.isArray(q) && num(q[0]) !== null && num(q[1]) !== null ? [+q[0], +q[1]] : null)).filter(Boolean);
    if (pts.length < 3) {
      const x = num(r && r.x), y = num(r && r.y), w = num(r && r.w), h = num(r && r.h);
      if ([x, y, w, h].includes(null)) return null;
      pts = rectPts(x, y, Math.max(0, w), Math.max(0, h));
    }
    return { id: safeId(r.id) || uid(), pts, name: String(r.name ?? '').slice(0, 60) };
  }).filter(Boolean);
  p.walls = (Array.isArray(d.walls) ? d.walls : []).map(w => {
    const pts = (Array.isArray(w && w.pts) ? w.pts : []).slice(0, 2)
      .map(q => (Array.isArray(q) && num(q[0]) !== null && num(q[1]) !== null ? [+q[0], +q[1]] : null)).filter(Boolean);
    return pts.length === 2 ? { id: safeId(w.id) || uid(), pts } : null;
  }).filter(Boolean);
  p.zones = (Array.isArray(d.zones) ? d.zones : []).map((z, i) => {
    const x = num(z && z.x), y = num(z && z.y), w = num(z && z.w), h = num(z && z.h);
    if ([x, y, w, h].includes(null)) return null;
    return { id: safeId(z.id) || uid(), x, y, w: Math.max(0, w), h: Math.max(0, h), name: str(z.name, 60), color: safeColor(z.color, i) };
  }).filter(Boolean);
  p.items = d.items.map(it => {
    const x = num(it && it.x), y = num(it && it.y);
    const type = it && it.type === 'ventilador' ? 'luz' : it && it.type;   // el ventilador se quitó: pasa a ser una boca de luz
    if (x === null || y === null || !SYMBOLS[type]) return null;
    const c = p.circuits.some(c => c.id === it.c) ? it.c : null;
    return { id: safeId(it.id) || uid(), type, x, y, c, rot: safeRot(it.rot), s: safeScale(it.s) };
  }).filter(Boolean);
  p.labels = (Array.isArray(d.labels) ? d.labels : []).map(l => {
    const x = num(l && l.x), y = num(l && l.y), text = str(l && l.text, 120);
    if (x === null || y === null || !text) return null;
    return { id: safeId(l.id) || uid(), x, y, text, rot: safeRot(l.rot), s: safeScale(l.s) };
  }).filter(Boolean);
  p.cables = (Array.isArray(d.cables) ? d.cables : []).map(cb => {
    const pts = (Array.isArray(cb && cb.pts) ? cb.pts : []).slice(0, 300)
      .map(q => (Array.isArray(q) && num(q[0]) !== null && num(q[1]) !== null ? [+q[0], +q[1]] : null)).filter(Boolean);
    if (pts.length < 2) return null;
    return { id: safeId(cb.id) || uid(), c: p.circuits.some(c => c.id === cb.c) ? cb.c : null, pts };
  }).filter(Boolean);
  p.iscale = safeScale(d.iscale); p.lscale = safeScale(d.lscale);
  p.active = p.circuits.some(c => c.id === d.active) ? d.active : p.circuits[0].id;
  return p;
}

/* ---------- estado ---------- */
let plan = newPlan();
export const getPlan = () => plan;
// sel: {kind:'room'|'wall'|'zone'|'item'|'label'|'cable', id, vi?}   vi: punto seleccionado de un cable o esquina de un ambiente
// draft: cable que se está dibujando (un solo checkpoint para todo el trazado)
export const session = { tool: 'select', sel: null, draft: null, merge: null, mergeErr: '' };   // merge: id del ambiente al que se está uniendo otro

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
  session.sel = null; session.draft = null;
  notify('data');
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(plan));
  plan = JSON.parse(redoStack.pop());
  session.sel = null; session.draft = null;
  notify('data');
}

// Abre otro plano: historial y selección propios.
export function setPlan(p) {
  plan = p;
  undoStack = []; redoStack = [];
  session.sel = null; session.tool = 'select'; session.draft = null;
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

// Cierra el cable en trazado: con menos de 2 puntos no es un cable y se descarta sin dejar historial.
export function endDraft() {
  const d = session.draft;
  if (!d) return;
  session.draft = null;
  if (d.pts.length < 2) { plan.cables = plan.cables.filter(c => c.id !== d.id); dropCheckpoint(); session.sel = null; }
}

export function setTool(tool) {
  if (tool !== 'cable') endDraft();
  session.tool = tool; session.merge = null; session.mergeErr = '';
  if (tool !== 'select') session.sel = null;
  if (tool !== 'room')
  notify('ui');
}

/* ---------- resumen (leyenda) ----------
   Por circuito: cantidad de bocas por tipo de símbolo que se asigna a circuitos.
   Lo que no es boca (tablero, termomagnéticas) va aparte en `other`. */
export function summarize(p = plan) {
  const types = SYMBOL_TYPES.filter(k => SYMBOLS[k].circuit && SYMBOLS[k].boca);
  const blank = () => ({ counts: Object.fromEntries(types.map(k => [k, 0])), total: 0 });
  const rows = p.circuits.map((c, i) => ({ id: c.id, n: i + 1, name: c.name, color: c.color, cableM: 0, ...blank() }));
  const orphan = { cableM: 0, ...blank() };
  const other = {};
  for (const it of p.items) {
    const sym = SYMBOLS[it.type];
    if (!sym) continue;
    if (!sym.circuit || !sym.boca) { other[it.type] = (other[it.type] || 0) + 1; continue; }
    const row = rows.find(r => r.id === it.c) || orphan;
    row.counts[it.type]++; row.total++;
  }
  // metros de cable aproximados por circuito (largo del recorrido / escala del plano)
  for (const cb of p.cables || []) {
    let len = 0;
    for (let i = 1; i < cb.pts.length; i++) len += Math.hypot(cb.pts[i][0] - cb.pts[i - 1][0], cb.pts[i][1] - cb.pts[i - 1][1]);
    (rows.find(r => r.id === cb.c) || orphan).cableM += len / U;
  }
  [...rows, orphan].forEach(r => { r.cableM = Math.round(r.cableM * 10) / 10; });
  const total = rows.reduce((a, r) => a + r.total, orphan.total);
  const cableTotal = Math.round([...rows, orphan].reduce((a, r) => a + r.cableM, 0) * 10) / 10;
  return { rows, orphan: orphan.total || orphan.cableM ? orphan : null, other, total, cableTotal };
}

// "3 luces · 2 llaves" (solo los tipos con cantidad)
export const countsText = counts =>
  Object.entries(counts).filter(([, n]) => n).map(([k, n]) => tn(`count.${k}`, n)).join(' · ') || '—';

// Detalle de una fila de la leyenda: "3 luces · 2 llaves · ≈ 12 m de cable"
export function describeRow(r) {
  const parts = Object.entries(r.counts).filter(([, n]) => n).map(([k, n]) => tn(`count.${k}`, n));
  if (r.cableM > 0) parts.push(t('legend.cable', { m: fmtNum(r.cableM) }));
  return parts.join(' · ') || '—';
}

// Datos técnicos de un circuito en una línea: "Prot. 2x16 A · Cable 2,5 mm² · Dif. 2x40 A 30 mA — nota"
export function techText(c) {
  const parts = [['prot', c.prot], ['cable', c.cable], ['rcd', c.rcd]]
    .filter(([, v]) => v && v.trim()).map(([k, v]) => `${t(`tech.${k}.short`)} ${v.trim()}`);
  let s = parts.join(' · ');
  if (c.notes && c.notes.trim()) s += (s ? ' — ' : '') + c.notes.trim();
  return s;
}
