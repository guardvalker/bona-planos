// Herramientas: qué hace cada gesto sobre el plano y las acciones de edición.
// Los gestos usan `checkpoint()` antes de mutar, una sola vez por gesto.
import {
  getPlan, session, snap, uid, SNAP, ISNAP, U, PALETTE, ROOM_TEMPLATES, circuitOf,
  checkpoint, dropCheckpoint, notify, setTool
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
    const obj = { room: plan.rooms, item: plan.items, label: plan.labels }[hit.k].find(o => o.id === hit.id);
    if (!obj) return null;
    session.sel = { kind: hit.k, id: hit.id };
    const d = { type: 'move', obj, kind: hit.k, dx: p.x - obj.x, dy: p.y - obj.y, pushed: false };
    // mover un ambiente arrastra también lo que hay adentro
    if (hit.k === 'room') {
      d.inside = plan.items
        .filter(i => i.x >= obj.x && i.x <= obj.x + obj.w && i.y >= obj.y && i.y <= obj.y + obj.h)
        .map(i => ({ i, dx: i.x - obj.x, dy: i.y - obj.y }));
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
    } else if (d.pushed) notify('data');
  },

  // segundo dedo mientras se dibujaba o movía: se descarta el gesto
  cancel(d) {
    if (d.type === 'draw') { removeRoom(d.r.id); dropCheckpoint(); session.sel = null; notify('ui'); }
  }
};

function removeRoom(id) { const p = getPlan(); p.rooms = p.rooms.filter(r => r.id !== id); }

/* ---------- acciones de edición ---------- */
export function deleteSelection() {
  const sel = session.sel, plan = getPlan();
  if (!sel) return;
  checkpoint();
  if (sel.kind === 'room') plan.rooms = plan.rooms.filter(r => r.id !== sel.id);
  else if (sel.kind === 'label') plan.labels = plan.labels.filter(l => l.id !== sel.id);
  else plan.items = plan.items.filter(i => i.id !== sel.id);
  session.sel = null;
  notify('data');
}

export function clearPlan() {
  const plan = getPlan();
  if (!plan.rooms.length && !plan.items.length && !plan.labels.length) return;
  if (!confirm(t('clear.confirm'))) return;
  checkpoint();
  plan.rooms = []; plan.items = []; plan.labels = [];
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
  if (sel && sel.kind === 'item') {
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
