import { applyStatic } from './i18n.js';
import { subscribe, setPlan, getPlan } from './state.js';
import { initCanvas, resetView } from './canvas.js';
import { handlers } from './tools.js';
import { initUI, render } from './ui.js';
import { loadPlan, savePlan, requestPersistence } from './storage.js';
import { initHome, renderHome } from './home.js';

let sync = null, openId = null;   // sync opcional: solo existe si hay config.js con credenciales

applyStatic();
initCanvas(handlers);
initUI({ goHome: () => { location.hash = '#/'; } });
initHome({ open: id => { location.hash = '#/p/' + id; } });

/* ---------- autoguardado ---------- */
let timer = null, dirty = false, editing = false;
async function flush() {
  clearTimeout(timer);
  if (!dirty) return;
  dirty = false;
  await savePlan(getPlan());
}
subscribe(kind => {
  render(kind);
  if (editing && (kind === 'data' || kind === 'soft')) {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  }
});
// Al ocultar o cerrar la app se guarda sin esperar el debounce.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);

/* ---------- rutas: #/ (inicio) y #/p/<id> (editor) ---------- */
let routing = Promise.resolve();
async function route() {
  await flush();
  const m = location.hash.match(/^#\/p\/([\w-]+)$/);
  const plan = m ? await loadPlan(m[1]) : null;
  if (plan) {
    editing = true;
    openId = plan.id;
    resetView();
    document.body.dataset.view = 'editor';
    setPlan(plan);
  } else {
    editing = false;
    openId = null;
    if (sync) sync.request(300);   // al volver al inicio se traen los cambios que quedaron pendientes
    document.body.dataset.view = 'home';
    await renderHome();
    if (m) location.replace('#/');   // plano inexistente
  }
}
// Sync opcional: sin config.js (o con los placeholders) no se carga ni se muestra nada.
(async () => {
  try {
    const cfg = (await import('../config.js')).default;
    if (!cfg || !cfg.url || !cfg.anonKey || /TU-PROYECTO|TU-ANON/.test(cfg.url + cfg.anonKey)) return;
    const [{ initSync }, { initSyncUI }] = await Promise.all([import('./sync.js'), import('./sync-ui.js')]);
    let onState = () => {};
    sync = await initSync(cfg, {
      onState: s => onState(s),
      getOpenId: () => openId,
      onData: () => { if (document.body.dataset.view === 'home') renderHome(); }
    });
    onState = initSyncUI(sync);
    onState(sync.state);
  } catch (e) { /* sin config: la app sigue 100% local */ }
})();

addEventListener('hashchange', () => { routing = routing.then(route); });
routing = routing.then(route);

requestPersistence();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
