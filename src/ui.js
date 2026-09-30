// Barra de herramientas, chips de circuitos, panel de selección y diálogo de datos.
import {
  getPlan, session, circuitOf, circuitIndex, checkpoint, notify, summarize, countsText, normalize,
  replacePlan, undo, redo, canUndo, canRedo
} from './state.js';
import { exportPng, exportSvg, printPlan, exportJson, readPlanFile } from './export.js';
import { SYMBOLS, SYMBOL_TYPES } from './symbols.js';
import { t, tn } from './i18n.js';
import { esc, zoomBy, renderCanvas } from './canvas.js';
import {
  setTool, deleteSelection, clearPlan, pickCircuit, addCircuit, removeCircuit
} from './tools.js';

const $ = s => document.querySelector(s);
const cShort = id => t('circuit.short', { n: circuitIndex(id) + 1 });
const cLabel = c => `${cShort(c.id)} ${esc(c.name)}`;

/* ---------- barra ---------- */
function buildBar() {
  const btn = (tool, label) => `<button data-tool="${tool}">${esc(label)}</button>`;
  $('#bar').innerHTML =
    btn('select', t('tool.select')) + btn('room', t('tool.room')) + '<span class="sep"></span>' +
    SYMBOL_TYPES.map(k => btn(k, t(`sym.${k}.btn`))).join('') + '<span class="sep"></span>' +
    `<button id="bUndo">${t('bar.undo')}</button><button id="bRedo">${t('bar.redo')}</button>` +
    `<button id="bExport">${t('bar.export')}</button><button id="bData">${t('bar.data')}</button><button id="bClear" class="danger">${t('bar.clear')}</button>`;
  $('#bar').setAttribute('aria-label', t('bar.label'));
}

function renderBar() {
  document.querySelectorAll('#bar [data-tool]').forEach(b => {
    const on = b.dataset.tool === session.tool;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
  $('#bUndo').disabled = !canUndo();
  $('#bRedo').disabled = !canRedo();
}

/* ---------- pista, chips ---------- */
function renderHint() {
  const plan = getPlan(), tool = session.tool;
  let s;
  if (tool === 'select') s = t('hint.select');
  else if (tool === 'room') s = t('hint.room');
  else {
    const c = circuitOf(plan.active);
    s = t('hint.place', { put: t(`sym.${tool}.put`) });
    s += SYMBOLS[tool].circuit ? t('hint.inCircuit', { circuit: c ? `${cShort(c.id)} ${c.name}` : t('circuit.none') }) : '.';
  }
  $('#hint').textContent = s;
}

function renderChips() {
  const plan = getPlan();
  $('#chips').innerHTML = plan.circuits.map(c => {
    const n = plan.items.filter(it => it.c === c.id).length;
    return `<button class="chip ${plan.active === c.id ? 'on' : ''}" data-c="${c.id}" aria-pressed="${plan.active === c.id}">
      <i style="background:${c.color}"></i>${cLabel(c)} <small>${n}</small></button>`;
  }).join('');
}

/* ---------- selección ---------- */
// Un solo checkpoint por sesión de edición de un campo (foco → blur).
function editOnce(input, fn) {
  let armed = false;
  input.addEventListener('focus', () => { armed = true; });
  input.addEventListener('input', () => {
    if (armed) { checkpoint(); armed = false; }
    fn(input.value);
    notify('soft');
  });
}

function renderSel() {
  const plan = getPlan(), sel = session.sel, el = $('#selrow');
  if (!sel) { el.innerHTML = `<span class="lbl">${t('sel.none')}</span>`; return; }
  if (sel.kind === 'room') {
    const r = plan.rooms.find(x => x.id === sel.id);
    if (!r) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="lbl">${t('room.label')}</span><input id="rname" type="text" value="${esc(r.name)}" aria-label="${t('room.name')}"><button id="bDel" class="danger">${t('sel.delete')}</button>`;
    editOnce($('#rname'), v => { r.name = v; });
  } else {
    const it = plan.items.find(x => x.id === sel.id);
    if (!it) { el.innerHTML = ''; return; }
    const sym = SYMBOLS[it.type], c = circuitOf(it.c);
    const name = t(`sym.${it.type}.name`);
    const label = sym.circuit
      ? t('sel.item', { name: name[0].toUpperCase() + name.slice(1), circuit: c ? cLabel(c) : t('circuit.none') }) + t('sel.reassign')
      : name[0].toUpperCase() + name.slice(1);
    el.innerHTML = `<span class="lbl">${label}</span><button id="bDel" class="danger">${t('sel.delete')}</button>`;
  }
  $('#bDel').addEventListener('click', deleteSelection);
}

/* ---------- editor de circuitos ---------- */
function renderCircuitEditor() {
  $('#clist').innerHTML = getPlan().circuits.map((c, i) => `
    <div class="crow" data-id="${c.id}">
      <b>${t('circuit.short', { n: i + 1 })}</b>
      <input type="color" value="${c.color}" aria-label="${t('circuit.color', { n: i + 1 })}">
      <input type="text" value="${esc(c.name)}" aria-label="${t('circuit.name', { n: i + 1 })}">
      <button class="danger" data-del="${c.id}" aria-label="${t('circuit.del', { n: i + 1 })}">✕</button>
    </div>`).join('');
  document.querySelectorAll('#clist .crow').forEach(row => {
    const c = circuitOf(row.dataset.id);
    const [color, name] = row.querySelectorAll('input');
    editOnce(color, v => { c.color = v; });
    editOnce(name, v => { c.name = v; });
  });
}

/* ---------- leyenda y resumen ---------- */
function renderLegend() {
  const sum = summarize();
  const row = (color, label, detail, total) =>
    `<div class="lrow"><i style="background:${color}"></i><span class="ln">${esc(label)}</span><span class="lc">${esc(detail)}</span><b>${tn('count.boca', total)}</b></div>`;
  let h = sum.rows.map(r => row(r.color, `${cShort(r.id)} ${r.name}`, countsText(r.counts), r.total)).join('');
  if (sum.orphan) h += row('#8b9aa8', t('circuit.none'), countsText(sum.orphan.counts), sum.orphan.total);
  const other = Object.entries(sum.other).map(([k, n]) => tn(`count.${k}`, n)).join(' · ');
  if (other) h += `<div class="lrow"><span class="lc">${esc(other)}</span></div>`;
  h += `<div class="lrow tot"><span class="ln">${t('legend.total')}</span><b>${tn('count.boca', sum.total)}</b></div>`;
  $('#legendBody').innerHTML = h;
}

/* ---------- render global ---------- */
export function render(kind) {
  if (kind === 'canvas') { renderCanvas(); return; }
  renderCanvas(); renderChips(); renderHint(); renderLegend();
  if (kind === 'soft') return;
  renderBar(); renderSel(); renderCircuitEditor();
  const pn = $('#pname');
  if (document.activeElement !== pn) pn.value = getPlan().name;
}

/* ---------- diálogo guardar / cargar ---------- */
function openModal() {
  $('#json').value = JSON.stringify(getPlan());
  $('#msg').textContent = '';
  $('#modal').classList.add('show');
  $('#json').focus();
}
const closeModal = () => $('#modal').classList.remove('show');
const closeExport = () => $('#exp').classList.remove('show');

export function initUI({ goHome }) {
  buildBar();
  $('#bBack').addEventListener('click', goHome);
  editOnce($('#pname'), v => { getPlan().name = v; });

  $('#bar').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
  $('#bUndo').addEventListener('click', undo);
  $('#bRedo').addEventListener('click', redo);
  $('#bClear').addEventListener('click', clearPlan);
  $('#bData').addEventListener('click', openModal);
  $('#zIn').addEventListener('click', () => zoomBy(1.25));
  $('#zOut').addEventListener('click', () => zoomBy(1 / 1.25));

  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (b) pickCircuit(b.dataset.c);
  });
  $('#clist').addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (b) removeCircuit(b.dataset.del);
  });
  $('#cAdd').addEventListener('click', addCircuit);

  $('#mClose').addEventListener('click', closeModal);
  $('#mCopy').addEventListener('click', async () => {
    const ta = $('#json');
    try { await navigator.clipboard.writeText(ta.value); $('#msg').textContent = t('data.copied'); }
    catch (e) { ta.select(); $('#msg').textContent = t('data.selected'); }
  });
  // Cargar sobre el plano abierto: conserva su id (y su nombre si el JSON no trae uno),
  // así el autoguardado actualiza este plano en vez de crear otro.
  const loadInto = p => {
    if (!p) return false;
    const cur = getPlan();
    p.id = cur.id;
    if (!p.name) p.name = cur.name;
    replacePlan(p);
    return true;
  };
  $('#mLoad').addEventListener('click', () => {
    let p = null;
    try { p = normalize(JSON.parse($('#json').value)); } catch (e) { /* JSON inválido */ }
    if (loadInto(p)) closeModal(); else $('#msg').textContent = t('data.error');
  });
  $('#mDown').addEventListener('click', exportJson);
  $('#mFile').addEventListener('click', () => $('#fileEditor').click());
  $('#fileEditor').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (loadInto(await readPlanFile(f))) closeModal(); else $('#msg').textContent = t('data.error');
  });

  $('#bExport').addEventListener('click', () => { $('#exp').classList.add('show'); $('#ePng').focus(); });
  $('#eClose').addEventListener('click', closeExport);
  $('#ePng').addEventListener('click', exportPng);
  $('#eSvg').addEventListener('click', exportSvg);
  $('#ePrint').addEventListener('click', () => { closeExport(); printPlan(); });

  document.addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if ((e.key === 'Delete' || e.key === 'Backspace') && session.sel) { e.preventDefault(); deleteSelection(); }
    else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'Escape') {
      if ($('#modal').classList.contains('show')) closeModal();
      else if ($('#exp').classList.contains('show')) closeExport();
      else setTool('select');
    }
  });
}
