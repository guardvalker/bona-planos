import { applyStatic } from './i18n.js';
import { subscribe, setPlan, getPlan } from './state.js';
import { initCanvas, resetView } from './canvas.js';
import { handlers } from './tools.js';
import { initUI, render } from './ui.js';
import { loadPlan, savePlan, requestPersistence } from './storage.js';
import { initHome, renderHome } from './home.js';

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
    resetView();
    document.body.dataset.view = 'editor';
    setPlan(plan);
  } else {
    editing = false;
    document.body.dataset.view = 'home';
    await renderHome();
    if (m) location.replace('#/');   // plano inexistente
  }
}
addEventListener('hashchange', () => { routing = routing.then(route); });
routing = routing.then(route);

requestPersistence();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
