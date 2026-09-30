// Pantalla de inicio: lista de planos (crear, abrir, renombrar, duplicar, borrar).
import { newPlan, uid } from './state.js';
import { APP_VERSION, CHANGELOG } from './version.js';
import { t, tn, lang, setLang } from './i18n.js';
import { esc } from './canvas.js';
import { readPlanFile } from './export.js';
import { askText } from './dialogs.js';
import { listPlans, loadPlan, savePlan, removePlan, persistent } from './storage.js';

const $ = s => document.querySelector(s);
const fmtDate = iso => new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/* ---------- acciones ---------- */
export async function createPlan(plans) {
  const p = newPlan(t('plan.default', { n: (plans ? plans.length : 0) + 1 }));
  await savePlan(p);
  return p.id;
}

async function duplicate(id) {
  const p = await loadPlan(id);
  if (!p) return;
  p.id = crypto.randomUUID ? crypto.randomUUID() : uid() + uid();
  p.name = (p.name || t('plan.unnamed')) + t('plan.copySuffix');
  p.updatedAt = new Date().toISOString();
  await savePlan(p);
}

async function rename(id) {
  const p = await loadPlan(id);
  if (!p) return;
  const name = await askText(t('plan.renameTitle'), p.name);
  if (name === null) return;
  p.name = name; p.updatedAt = new Date().toISOString();
  await savePlan(p);
}

/* ---------- render ---------- */
export async function renderHome() {
  $('#hWarn').hidden = persistent;
  const plans = await listPlans();
  const list = $('#hList');
  if (!plans.length) { list.innerHTML = `<p class="empty">${t('home.empty')}</p>`; return; }
  list.innerHTML = plans.map(p => `
    <article class="pcard" data-id="${p.id}">
      <button class="open" data-act="open">
        <span class="pn">${esc(p.name || t('plan.unnamed'))}</span>
        <span class="pm">${tn('count.room', p.rooms.length)} · ${tn('count.item', p.items.length)} · ${fmtDate(p.updatedAt)}</span>
      </button>
      <div class="acts">
        <button data-act="rename">${t('plan.rename')}</button>
        <button data-act="dup">${t('plan.duplicate')}</button>
        <button data-act="del" class="danger">${t('plan.delete')}</button>
      </div>
    </article>`).join('');
}

// `open(id)` navega al editor.
export function initHome({ open }) {
  $('#hVer').textContent = t('about.version', { v: APP_VERSION });
  $('#hAbout').addEventListener('click', () => {
    $('#abBody').innerHTML = CHANGELOG.map(c =>
      `<h3>${esc(c.v)} · ${esc(c.date)}</h3><ul>${c.items.map(k => `<li>${esc(t(k))}</li>`).join('')}</ul>`).join('');
    $('#about').classList.add('show');
    $('#abClose').focus();
  });
  $('#lEs').addEventListener('click', () => setLang('es'));
  $('#lEn').addEventListener('click', () => setLang('en'));
  $('#lEs').setAttribute('aria-pressed', lang === 'es');
  $('#lEn').setAttribute('aria-pressed', lang === 'en');
  $('#abClose').addEventListener('click', () => $('#about').classList.remove('show'));
  $('#about').addEventListener('keydown', e => { if (e.key === 'Escape') $('#about').classList.remove('show'); });
  // Actualización manual: borra caches y service workers y recarga (no depende de que sw.js haya cambiado).
  $('#abUpdate').addEventListener('click', async () => {
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { /* sin SW: solo recarga */ }
    location.reload();
  });
  $('#hNew').addEventListener('click', async () => open(await createPlan(await listPlans())));
  // Importar desde archivo: siempre entra como plano nuevo (no pisa uno existente con el mismo id).
  $('#hImport').addEventListener('click', () => $('#fileHome').click());
  $('#fileHome').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const p = await readPlanFile(f);
    if (!p) { alert(t('import.error')); return; }
    p.id = crypto.randomUUID ? crypto.randomUUID() : uid() + uid();
    if (!p.name) p.name = f.name.replace(/\.json$/i, '') || t('plan.unnamed');
    await savePlan(p);
    open(p.id);
  });
  $('#hList').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    switch (b.dataset.act) {
      case 'open': open(id); return;
      case 'rename': await rename(id); break;
      case 'dup': await duplicate(id); break;
      case 'del': {
        const p = await loadPlan(id);
        if (p && confirm(t('plan.deleteConfirm', { name: p.name || t('plan.unnamed') }))) await removePlan(id);
        break;
      }
    }
    renderHome();
  });
}
