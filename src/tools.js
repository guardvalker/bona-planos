// Herramientas: qué hace cada gesto sobre el plano y las acciones de edición.
// Los gestos usan `checkpoint()` antes de mutar, una sola vez por gesto.
import {
  getPlan, session, snap, uid, SNAP, ISNAP, U, PALETTE, circuitOf, safeScale, rectPts, bbox, inPoly,
  checkpoint, dropCheckpoint, notify, setTool, endDraft
} from './state.js';
import { askText } from './dialogs.js';
import { SYMBOLS } from './symbols.js';
import { t } from './i18n.js';
import { unionRooms } from './geom.js';

export const isPlaceTool = tool => tool in SYMBOLS;

/* ---------- gestos sobre el plano (los llama canvas.js) ---------- */
export const handlers = {
  // Devuelve el estado del gesto, o nada para que canvas.js haga pan.
  down(p, hit) {
    const plan = getPlan();
    const tool = session.tool;

    if (tool === 'label') {
      const x = snap(p.x, ISNAP), y = snap(p.y, ISNAP);
      askText(t('label.prompt'), '').then(text => {
        if (!text) return;
        const id = uid();
        checkpoint();
        getPlan().labels.push({ id, x, y, text, rot: 0, s: getPlan().lscale || 1 });
        session.sel = { kind: 'label', id }; session.tool = 'select';
        notify('data');
      });
      return { type: 'place' };
    }
    if (tool === 'cable') return { type: 'cabletap', tap: true, p };   // el punto se agrega al soltar
    if (tool === 'zone') {
      checkpoint();
      const x = snap(p.x), y = snap(p.y);
      const z = { id: uid(), x, y, w: 0, h: 0, name: t('zone.default', { n: plan.zones.length + 1 }), color: PALETTE[plan.zones.length % PALETTE.length] };
      plan.zones.push(z);
      session.sel = { kind: 'zone', id: z.id };
      notify('canvas');
      return { type: 'draw', r: z, ox: x, oy: y, kind: 'zone' };
    }
    if (tool === 'room') {
      checkpoint();
      const x = snap(p.x), y = snap(p.y);
      const r = { id: uid(), pts: rectPts(x, y, 0, 0), name: t('room.default', { n: plan.rooms.length + 1 }) };
      plan.rooms.push(r);
      session.sel = { kind: 'room', id: r.id };
      notify('canvas');
      return { type: 'draw', r, ox: x, oy: y, kind: 'room' };
    }
    if (tool === 'wall') {
      checkpoint();
      const x = snap(p.x), y = snap(p.y);
      const w = { id: uid(), pts: [[x, y], [x, y]] };
      plan.walls.push(w);
      session.sel = { kind: 'wall', id: w.id };
      notify('canvas');
      return { type: 'wdraw', w };
    }
    if (isPlaceTool(tool)) {
      checkpoint();
      plan.items.push({ id: uid(), type: tool, x: snap(p.x, ISNAP), y: snap(p.y, ISNAP), c: SYMBOLS[tool].circuit ? plan.active : null, rot: 0, s: plan.iscale || 1 });
      notify('data');
      return { type: 'place' };
    }
    // modo "Unir": el próximo ambiente tocado se une al seleccionado
    if (session.merge) {
      if (hit && hit.k === 'room' && hit.id !== session.merge) { mergeRooms(session.merge, hit.id); return { type: 'place' }; }
      session.merge = null; session.mergeErr = '';
      if (!hit || hit.k !== 'room') { session.sel = null; notify('ui'); return null; }
    }
    // herramienta mover
    if (!hit) { session.sel = null; notify('ui'); return null; }
    if (hit.k === 'zhandle') return { type: 'resize', r: plan.zones.find(r => r.id === hit.id), pushed: false };
    if (hit.k === 'rvertex' || hit.k === 'rmid') {
      const r = plan.rooms.find(x => x.id === hit.id);
      if (!r) return null;
      let i = +hit.i, pushed = false;
      if (hit.k === 'rmid') {                         // tocar el "+" de una pared suma una esquina en el medio
        checkpoint(); pushed = true;
        const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
        r.pts.splice(i + 1, 0, [snap((a[0] + b[0]) / 2), snap((a[1] + b[1]) / 2)]);
        i += 1;
        notify('data');
      }
      session.sel = { kind: 'room', id: r.id, vi: i };
      if (!pushed) notify('ui');
      return { type: 'rvertex', r, i, pushed };
    }
    if (hit.k === 'wvertex' || hit.k === 'wall') {
      const w = plan.walls.find(x => x.id === hit.id);
      if (!w) return null;
      session.sel = { kind: 'wall', id: w.id };
      notify('ui');
      if (hit.k === 'wvertex') return { type: 'wvertex', w, i: +hit.i, pushed: false };
      return { type: 'wmove', w, orig: w.pts.map(q => [...q]), sx: p.x, sy: p.y, pushed: false };
    }
    if (hit.k === 'vertex' || hit.k === 'midpt' || hit.k === 'cable') {
      const cb = plan.cables.find(c => c.id === hit.id);
      if (!cb) return null;
      if (hit.k === 'cable') {
        session.sel = { kind: 'cable', id: cb.id };
        notify('ui');
        return { type: 'cmove', cable: cb, orig: cb.pts.map(q => [...q]), sx: p.x, sy: p.y, pushed: false };
      }
      let i = +hit.i;
      if (hit.k === 'midpt') {                        // tocar el "+" de un tramo suma un punto en el medio
        checkpoint();
        const a = cb.pts[i], b = cb.pts[i + 1];
        cb.pts.splice(i + 1, 0, [snap((a[0] + b[0]) / 2, ISNAP), snap((a[1] + b[1]) / 2, ISNAP)]);
        i += 1;
        session.sel = { kind: 'cable', id: cb.id, vi: i };
        notify('data');
        return { type: 'vertex', cable: cb, i, pushed: true };
      }
      session.sel = { kind: 'cable', id: cb.id, vi: i };
      notify('ui');
      return { type: 'vertex', cable: cb, i, pushed: false };
    }
    if (hit.k === 'room') {
      const r = plan.rooms.find(o => o.id === hit.id);
      if (!r) return null;
      session.sel = { kind: 'room', id: r.id };
      // mover un ambiente arrastra también lo que hay adentro (y los cables que quedan enteros adentro)
      const inside = (x, y) => inPoly(x, y, r.pts);
      notify('ui');
      return {
        type: 'rmove', r, sx: p.x, sy: p.y, pushed: false, orig: r.pts.map(q => [...q]),
        items: plan.items.filter(i => inside(i.x, i.y)).map(i => ({ i, x: i.x, y: i.y })),
        cables: plan.cables.filter(cb => cb.pts.every(q => inside(q[0], q[1]))).map(cb => ({ cb, orig: cb.pts.map(q => [...q]) })),
        walls: plan.walls.filter(w => w.pts.every(q => inside(q[0], q[1]))).map(w => ({ w, orig: w.pts.map(q => [...q]) }))
      };
    }
    const obj = { zone: plan.zones, item: plan.items, label: plan.labels }[hit.k].find(o => o.id === hit.id);
    if (!obj) return null;
    session.sel = { kind: hit.k, id: hit.id };
    const d = { type: 'move', obj, kind: hit.k, dx: p.x - obj.x, dy: p.y - obj.y, pushed: false };
    notify('ui');
    return d;
  },

  move(d, p) {
    if (d.type === 'draw') {
      const x = snap(p.x), y = snap(p.y);
      const bx = Math.min(d.ox, x), by = Math.min(d.oy, y), bw = Math.abs(x - d.ox), bh = Math.abs(y - d.oy);
      if (d.kind === 'room') d.r.pts = rectPts(bx, by, bw, bh);
      else { d.r.x = bx; d.r.y = by; d.r.w = bw; d.r.h = bh; }
    } else if (d.type === 'wdraw') {
      d.w.pts[1] = wallEnd(d.w.pts[0], p);
    } else if (d.type === 'wvertex') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      d.w.pts[d.i] = [snap(p.x), snap(p.y)];
    } else if (d.type === 'wmove') {
      const ddx = snap(p.x - d.sx), ddy = snap(p.y - d.sy);
      if (!d.pushed && (ddx || ddy)) { checkpoint(); d.pushed = true; }
      d.w.pts = d.orig.map(q => [q[0] + ddx, q[1] + ddy]);
    } else if (d.type === 'rvertex') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      d.r.pts[d.i] = [snap(p.x), snap(p.y)];
    } else if (d.type === 'rmove') {
      const ddx = snap(p.x - d.sx), ddy = snap(p.y - d.sy);
      if (!d.pushed && (ddx || ddy)) { checkpoint(); d.pushed = true; }
      d.r.pts = d.orig.map(q => [q[0] + ddx, q[1] + ddy]);
      d.items.forEach(o => { o.i.x = o.x + ddx; o.i.y = o.y + ddy; });
      d.cables.forEach(o => { o.cb.pts = o.orig.map(q => [q[0] + ddx, q[1] + ddy]); });
      d.walls.forEach(o => { o.w.pts = o.orig.map(q => [q[0] + ddx, q[1] + ddy]); });
    } else if (d.type === 'resize') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      d.r.w = Math.max(SNAP, snap(p.x) - d.r.x);
      d.r.h = Math.max(SNAP, snap(p.y) - d.r.y);
    } else if (d.type === 'move') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      const step = d.kind === 'zone' ? SNAP : ISNAP;
      d.obj.x = snap(p.x - d.dx, step);
      d.obj.y = snap(p.y - d.dy, step);
    } else if (d.type === 'cmove') {
      const ddx = snap(p.x - d.sx, ISNAP), ddy = snap(p.y - d.sy, ISNAP);
      if (!d.pushed && (ddx || ddy)) { checkpoint(); d.pushed = true; }
      d.cable.pts = d.orig.map(q => [q[0] + ddx, q[1] + ddy]);
    } else if (d.type === 'vertex') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      d.cable.pts[d.i] = cablePoint(p);
    } else return;
    notify('canvas');
  },

  up(d) {
    if (d.type === 'wdraw') {
      const [a, b] = d.w.pts;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < SNAP * 2) {
        getPlan().walls = getPlan().walls.filter(w => w.id !== d.w.id); dropCheckpoint(); session.sel = null;
        notify('ui');
      } else notify('data');                          // sigue en Pared para trazar la siguiente
    } else if (d.type === 'draw') {
      const b = d.kind === 'room' ? bbox(d.r.pts) : d.r;
      if (b.w < SNAP * 2 || b.h < SNAP * 2) {
        removeShape(d.kind, d.r.id); dropCheckpoint(); session.sel = null;
        notify('ui');
      } else {
        session.tool = 'select';       // después de dibujar un ambiente o una zona vuelve a Mover
        notify('data');
      }
    } else if (d.type === 'cabletap') addCablePoint(d.p);
    else if (d.pushed) notify('data');
  },

  // segundo dedo mientras se dibujaba o movía: se descarta el gesto
  cancel(d) {
    if (d.type === 'draw') { removeShape(d.kind, d.r.id); dropCheckpoint(); session.sel = null; notify('ui'); }
    else if (d.type === 'wdraw') { getPlan().walls = getPlan().walls.filter(w => w.id !== d.w.id); dropCheckpoint(); session.sel = null; notify('ui'); }
  }
};

// Extremo de una pared: a la grilla, y si queda casi horizontal o vertical se endereza.
function wallEnd(a, p) {
  let x = snap(p.x), y = snap(p.y);
  if (Math.abs(x - a[0]) <= SNAP) x = a[0];
  else if (Math.abs(y - a[1]) <= SNAP) y = a[1];
  return [x, y];
}

// Punto de cable: a la grilla de 5, o enganchado al elemento más cercano (para "conectar" el cable).
function cablePoint(p) {
  let best = null, bd = 14;
  for (const i of getPlan().items) {
    const d = Math.hypot(i.x - p.x, i.y - p.y);
    if (d <= bd) { best = i; bd = d; }
  }
  return best ? [best.x, best.y] : [snap(p.x, ISNAP), snap(p.y, ISNAP)];
}

function addCablePoint(p) {
  const plan = getPlan(), pt = cablePoint(p);
  let d = session.draft;
  if (!d) {
    checkpoint();
    d = { id: uid(), c: plan.active, pts: [pt] };
    plan.cables.push(d);
    session.draft = d;
    session.sel = { kind: 'cable', id: d.id };
  } else {
    const last = d.pts[d.pts.length - 1];
    if (Math.hypot(last[0] - pt[0], last[1] - pt[1]) < 12) { finishCable(); return; }   // tocar el último punto termina
    d.pts.push(pt);
  }
  notify('data');
}

// "Listo": deja el cable seleccionado en Mover para poder ajustarlo.
export function finishCable() {
  const d = session.draft;
  endDraft();
  session.tool = 'select';
  session.sel = d && d.pts.length >= 2 ? { kind: 'cable', id: d.id } : null;
  notify('data');
}

// "Cancelar": descarta el cable en trazado entero (deshace su único checkpoint).
export function cancelCable() {
  const d = session.draft;
  if (!d) return;
  const plan = getPlan();
  plan.cables = plan.cables.filter(c => c.id !== d.id);
  session.draft = null; session.sel = null;
  dropCheckpoint();
  notify('data');
}

// Quita el punto seleccionado de un cable (mínimo quedan 2).
export function deleteVertex() {
  const sel = session.sel, plan = getPlan();
  if (!sel || sel.kind !== 'cable' || sel.vi === undefined) return;
  const cb = plan.cables.find(c => c.id === sel.id);
  if (!cb || cb.pts.length <= 2) return;
  checkpoint();
  cb.pts.splice(sel.vi, 1);
  session.sel = { kind: 'cable', id: cb.id };
  notify('data');
}

export function startMerge() {
  const sel = session.sel;
  if (!sel || sel.kind !== 'room' || getPlan().rooms.length < 2) return;
  session.merge = sel.id; session.mergeErr = '';
  notify('ui');
}
export function cancelMerge() { session.merge = null; session.mergeErr = ''; notify('ui'); }

// Une el ambiente `bid` al `aid` (queda el nombre y el id del primero).
function mergeRooms(aid, bid) {
  const plan = getPlan(), a = plan.rooms.find(r => r.id === aid), b = plan.rooms.find(r => r.id === bid);
  if (!a || !b) { cancelMerge(); return; }
  const res = unionRooms(a.pts, b.pts);
  if (res.error) { session.mergeErr = res.error; notify('ui'); return; }
  checkpoint();
  a.pts = res.pts;
  plan.rooms = plan.rooms.filter(r => r.id !== bid);
  session.merge = null; session.mergeErr = '';
  session.sel = { kind: 'room', id: a.id };
  notify('data');
}

// Quita la esquina seleccionada de un ambiente (mínimo quedan 3).
export function deleteRoomVertex() {
  const sel = session.sel, plan = getPlan();
  if (!sel || sel.kind !== 'room' || sel.vi === undefined) return;
  const r = plan.rooms.find(x => x.id === sel.id);
  if (!r || r.pts.length <= 3) return;
  checkpoint();
  r.pts.splice(sel.vi, 1);
  session.sel = { kind: 'room', id: r.id };
  notify('data');
}

function removeShape(kind, id) {
  const p = getPlan();
  if (kind === 'zone') p.zones = p.zones.filter(z => z.id !== id);
  else p.rooms = p.rooms.filter(r => r.id !== id);
}

/* ---------- acciones de edición ---------- */
export function deleteSelection() {
  const sel = session.sel, plan = getPlan();
  if (!sel) return;
  checkpoint();
  if (sel.kind === 'room') plan.rooms = plan.rooms.filter(r => r.id !== sel.id);
  else if (sel.kind === 'wall') plan.walls = plan.walls.filter(w => w.id !== sel.id);
  else if (sel.kind === 'zone') plan.zones = plan.zones.filter(z => z.id !== sel.id);
  else if (sel.kind === 'label') plan.labels = plan.labels.filter(l => l.id !== sel.id);
  else if (sel.kind === 'cable') plan.cables = plan.cables.filter(c => c.id !== sel.id);
  else plan.items = plan.items.filter(i => i.id !== sel.id);
  session.sel = null;
  notify('data');
}

export function clearPlan() {
  const plan = getPlan();
  if (!plan.rooms.length && !plan.walls.length && !plan.items.length && !plan.labels.length && !plan.cables.length && !plan.zones.length) return;
  if (!confirm(t('clear.confirm'))) return;
  checkpoint();
  plan.rooms = []; plan.walls = []; plan.items = []; plan.labels = []; plan.cables = []; plan.zones = [];
  session.sel = null;
  notify('data');
}

// Gira 90° el elemento o la etiqueta seleccionados.
export function rotateSelection() {
  const sel = session.sel, plan = getPlan();
  if (!sel || sel.kind === 'room' || sel.kind === 'wall' || sel.kind === 'zone') return;
  const obj = (sel.kind === 'item' ? plan.items : plan.labels).find(o => o.id === sel.id);
  if (!obj) return;
  checkpoint();
  obj.rot = ((obj.rot || 0) + 90) % 360;
  notify('data');
}

// Agranda o achica (×1,25 / ÷1,25) el elemento o la etiqueta seleccionados.
export function scaleSelection(dir) {
  const sel = session.sel, plan = getPlan();
  if (!sel || (sel.kind !== 'item' && sel.kind !== 'label')) return;
  const obj = (sel.kind === 'item' ? plan.items : plan.labels).find(o => o.id === sel.id);
  if (!obj) return;
  const s = safeScale((obj.s || 1) * (dir > 0 ? 1.25 : 0.8));
  if (s === (obj.s || 1)) return;
  checkpoint();
  obj.s = s;
  notify('data');
}

// Deja todos los elementos (o etiquetas) con la escala del seleccionado, y las nuevas también.
export function scaleAll() {
  const sel = session.sel, plan = getPlan();
  if (!sel || (sel.kind !== 'item' && sel.kind !== 'label')) return;
  const list = sel.kind === 'item' ? plan.items : plan.labels;
  const obj = list.find(o => o.id === sel.id);
  if (!obj) return;
  checkpoint();
  const s = obj.s || 1;
  list.forEach(o => { o.s = s; });
  plan[sel.kind === 'item' ? 'iscale' : 'lscale'] = s;
  notify('data');
}

// Elegir un circuito cambia solo el circuito activo (el de lo próximo que se coloque o trace).
// Lo ya dibujado se reasigna aparte, con el selector de la fila de selección.
export function pickCircuit(id) {
  const plan = getPlan();
  if (!circuitOf(id)) return;
  plan.active = id;
  if (session.draft) session.draft.c = id;              // cambiar de circuito mientras se traza no suma historial
  notify('data');
}

// Reasigna al circuito `id` el elemento o cable seleccionado.
export function assignSelection(id) {
  const sel = session.sel, plan = getPlan();
  if (!sel || !circuitOf(id)) return;
  const obj = sel.kind === 'cable' ? plan.cables.find(c => c.id === sel.id)
    : sel.kind === 'item' ? plan.items.find(i => i.id === sel.id) : null;
  if (!obj || obj.c === id || (sel.kind === 'item' && !SYMBOLS[obj.type].circuit)) return;
  checkpoint();
  obj.c = id;
  notify('data');
}

// Color de la zona seleccionada (un solo checkpoint por cambio).
export function setZoneColor(color) {
  const sel = session.sel, z = sel && sel.kind === 'zone' && getPlan().zones.find(x => x.id === sel.id);
  if (!z || z.color === color) return;
  checkpoint();
  z.color = color;
  notify('data');
}

export function addCircuit() {
  const plan = getPlan(), n = plan.circuits.length;
  checkpoint();
  plan.circuits.push({ id: uid(), name: t('circuit.default', { n: n + 1 }), color: PALETTE[n % PALETTE.length] });
  notify('data');
}

export function removeCircuit(id) {
  const plan = getPlan();
  if (plan.circuits.length <= 1) return;
  const used = plan.items.filter(i => i.c === id).length;
  if (used && !confirm(t('circuit.delConfirm', { n: used }))) return;
  checkpoint();
  plan.circuits = plan.circuits.filter(c => c.id !== id);
  plan.items.forEach(i => { if (i.c === id) i.c = null; });
  if (plan.active === id) plan.active = plan.circuits[0].id;
  notify('data');
}

export { setTool };
