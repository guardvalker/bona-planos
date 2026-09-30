// Herramientas: qué hace cada gesto sobre el plano y las acciones de edición.
// Los gestos usan `checkpoint()` antes de mutar, una sola vez por gesto.
import {
  getPlan, session, snap, uid, SNAP, ISNAP, U, PALETTE, ROOM_TEMPLATES, circuitOf,
  checkpoint, dropCheckpoint, notify, setTool, endDraft
} from './state.js';
import { askText } from './dialogs.js';
import { SYMBOLS } from './symbols.js';
import { t } from './i18n.js';

export const isPlaceTool = tool => tool in SYMBOLS;

/* ---------- gestos sobre el plano (los llama canvas.js) ---------- */
export const handlers = {
  // Devuelve el estado del gesto, o nada para que canvas.js haga pan.
  down(p, hit) {
    const plan = getPlan();
    const tool = session.tool;

    if (tool === 'room' && session.template) {
      // plantilla: un toque ubica el ambiente con medidas típicas
      const tpl = session.template;
      checkpoint();
      const r = { id: uid(), x: snap(p.x), y: snap(p.y), w: Math.round(tpl.w * U), h: Math.round(tpl.h * U), name: t(`tpl.${tpl.key}`) };
      plan.rooms.push(r);
      session.sel = { kind: 'room', id: r.id };
      session.template = null; session.tool = 'select';
      notify('data');
      return { type: 'place' };
    }
    if (tool === 'label') {
      const x = snap(p.x, ISNAP), y = snap(p.y, ISNAP);
      askText(t('label.prompt'), '').then(text => {
        if (!text) return;
        const id = uid();
        checkpoint();
        getPlan().labels.push({ id, x, y, text, rot: 0 });
        session.sel = { kind: 'label', id }; session.tool = 'select';
        notify('data');
      });
      return { type: 'place' };
    }
    if (tool === 'cable') return { type: 'cabletap', tap: true, p };   // el punto se agrega al soltar
    if (tool === 'room') {
      checkpoint();
      const x = snap(p.x), y = snap(p.y);
      const r = { id: uid(), x, y, w: 0, h: 0, name: t('room.default', { n: plan.rooms.length + 1 }) };
      plan.rooms.push(r);
      session.sel = { kind: 'room', id: r.id };
      notify('canvas');
      return { type: 'draw', r, ox: x, oy: y };
    }
    if (isPlaceTool(tool)) {
      checkpoint();
      plan.items.push({ id: uid(), type: tool, x: snap(p.x, ISNAP), y: snap(p.y, ISNAP), c: SYMBOLS[tool].circuit ? plan.active : null, rot: 0 });
      notify('data');
      return { type: 'place' };
    }
    // herramienta mover
    if (!hit) { session.sel = null; notify('ui'); return null; }
    if (hit.k === 'handle') {
      return { type: 'resize', r: plan.rooms.find(r => r.id === hit.id), pushed: false };
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
    const obj = { room: plan.rooms, item: plan.items, label: plan.labels }[hit.k].find(o => o.id === hit.id);
    if (!obj) return null;
    session.sel = { kind: hit.k, id: hit.id };
    const d = { type: 'move', obj, kind: hit.k, dx: p.x - obj.x, dy: p.y - obj.y, pushed: false };
    // mover un ambiente arrastra también lo que hay adentro
    if (hit.k === 'room') {
      const inside = (x, y) => x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h;
      d.inside = plan.items.filter(i => inside(i.x, i.y)).map(i => ({ i, dx: i.x - obj.x, dy: i.y - obj.y }));
      // los cables se mueven con el ambiente solo si están enteros adentro
      d.x0 = obj.x; d.y0 = obj.y;
      d.cables = plan.cables.filter(cb => cb.pts.every(q => inside(q[0], q[1]))).map(cb => ({ cb, orig: cb.pts.map(q => [...q]) }));
    }
    notify('ui');
    return d;
  },

  move(d, p) {
    if (d.type === 'draw') {
      const x = snap(p.x), y = snap(p.y);
      d.r.x = Math.min(d.ox, x); d.r.y = Math.min(d.oy, y);
      d.r.w = Math.abs(x - d.ox); d.r.h = Math.abs(y - d.oy);
    } else if (d.type === 'resize') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      d.r.w = Math.max(SNAP, snap(p.x) - d.r.x);
      d.r.h = Math.max(SNAP, snap(p.y) - d.r.y);
    } else if (d.type === 'move') {
      if (!d.pushed) { checkpoint(); d.pushed = true; }
      const step = d.kind === 'room' ? SNAP : ISNAP;
      d.obj.x = snap(p.x - d.dx, step);
      d.obj.y = snap(p.y - d.dy, step);
      if (d.inside) d.inside.forEach(o => { o.i.x = d.obj.x + o.dx; o.i.y = d.obj.y + o.dy; });
      if (d.cables) {
        const ddx = d.obj.x - d.x0, ddy = d.obj.y - d.y0;
        d.cables.forEach(o => { o.cb.pts = o.orig.map(q => [q[0] + ddx, q[1] + ddy]); });
      }
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
    if (d.type === 'draw') {
      if (d.r.w < SNAP * 2 || d.r.h < SNAP * 2) {
        removeRoom(d.r.id); dropCheckpoint(); session.sel = null;
        notify('ui');
      } else {
        session.tool = 'select';       // después de dibujar un ambiente vuelve a Mover
        notify('data');
      }
    } else if (d.type === 'cabletap') addCablePoint(d.p);
    else if (d.pushed) notify('data');
  },

  // segundo dedo mientras se dibujaba o movía: se descarta el gesto
  cancel(d) {
    if (d.type === 'draw') { removeRoom(d.r.id); dropCheckpoint(); session.sel = null; notify('ui'); }
  }
};

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

function removeRoom(id) { const p = getPlan(); p.rooms = p.rooms.filter(r => r.id !== id); }

/* ---------- acciones de edición ---------- */
export function deleteSelection() {
  const sel = session.sel, plan = getPlan();
  if (!sel) return;
  checkpoint();
  if (sel.kind === 'room') plan.rooms = plan.rooms.filter(r => r.id !== sel.id);
  else if (sel.kind === 'label') plan.labels = plan.labels.filter(l => l.id !== sel.id);
  else if (sel.kind === 'cable') plan.cables = plan.cables.filter(c => c.id !== sel.id);
  else plan.items = plan.items.filter(i => i.id !== sel.id);
  session.sel = null;
  notify('data');
}

export function clearPlan() {
  const plan = getPlan();
  if (!plan.rooms.length && !plan.items.length && !plan.labels.length && !plan.cables.length) return;
  if (!confirm(t('clear.confirm'))) return;
  checkpoint();
  plan.rooms = []; plan.items = []; plan.labels = []; plan.cables = [];
  session.sel = null;
  notify('data');
}

// Gira 90° el elemento o la etiqueta seleccionados.
export function rotateSelection() {
  const sel = session.sel, plan = getPlan();
  if (!sel || sel.kind === 'room') return;
  const obj = (sel.kind === 'item' ? plan.items : plan.labels).find(o => o.id === sel.id);
  if (!obj) return;
  checkpoint();
  obj.rot = ((obj.rot || 0) + 90) % 360;
  notify('data');
}

// Elegir una plantilla arma la herramienta Ambiente: el próximo toque la ubica.
export function armTemplate(key) {
  session.template = ROOM_TEMPLATES.find(x => x.key === key) || null;
  session.tool = 'room'; session.sel = null;
  notify('ui');
}

// Tocar un chip: activa el circuito y, si hay un elemento seleccionado, se lo reasigna.
export function pickCircuit(id) {
  const plan = getPlan();
  if (!circuitOf(id)) return;
  plan.active = id;
  const sel = session.sel;
  if (session.draft) session.draft.c = id;              // cambiar de circuito mientras se traza no suma historial
  else if (sel && sel.kind === 'cable') {
    const cb = plan.cables.find(c => c.id === sel.id);
    if (cb && cb.c !== id) { checkpoint(); cb.c = id; }
  } else if (sel && sel.kind === 'item') {
    const it = plan.items.find(i => i.id === sel.id);
    if (it && SYMBOLS[it.type].circuit && it.c !== id) { checkpoint(); it.c = id; }
  }
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
