// Sync opcional con Supabase (una fila por plano en bp_plans). Solo se carga si existe
// config.js con credenciales; sin sesión no hace nada. La app nunca depende de esto.
//
// Conciliación por plano (ver `reconcile`): gana el updatedAt más reciente. Para no perder
// ni resucitar planos se guarda, por cuenta, el updatedAt de cada plano en la última
// sincronización (`map`) y los borrados locales pendientes de propagar (`del`).
import { normalize } from './state.js';
import { listPlans, savePlan, removePlan, onStorage } from './storage.js';

const TABLE = 'bp_plans';
const STORE_KEY = 'bona-planos:sync';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- estado persistente (por dispositivo) ---------- */
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') return { user: s.user || null, map: s.map || {}, del: s.del || [] };
  } catch (e) { /* vacío */ }
  return { user: null, map: {}, del: [] };
}
function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* sin storage */ } }

/* ---------- carga de la librería (solo cuando hace falta) ---------- */
let libPromise = null;
function loadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  return libPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js';
    s.onload = () => resolve(window.supabase);
    s.onerror = () => { libPromise = null; reject(new Error('No se pudo cargar la librería de sync.')); };
    document.head.append(s);
  });
}

// ¿Hay una sesión guardada de una visita anterior? (supabase-js la guarda en localStorage)
export function hasStoredSession() {
  try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)); } catch (e) { return false; }
}

export async function initSync(cfg, hooks = {}) {
  let sb = null, user = null;
  let running = false, again = false, timer = null;
  const state = { status: 'idle', error: '', lastSync: null, notes: [] };   // status: idle|syncing|offline|error

  const emit = () => hooks.onState && hooks.onState({ ...state, user });
  const setStatus = (status, error = '') => { state.status = status; state.error = error; emit(); };

  async function ensureClient() {
    if (sb) return sb;
    const lib = await loadLib();
    sb = lib.createClient(cfg.url, cfg.anonKey);
    sb.auth.onAuthStateChange((_ev, session) => {
      const next = session ? session.user : null;
      if (next && (!user || user.id !== next.id)) { user = next; emit(); request(0); }
      else if (!next && user) { user = null; emit(); }
    });
    const { data } = await sb.auth.getSession();
    user = data && data.session ? data.session.user : null;
    emit();
    return sb;
  }

  /* ---------- autenticación (email + código de un solo uso) ---------- */
  async function sendOtp(email) {
    const c = await ensureClient();
    const { error } = await c.auth.signInWithOtp({ email });
    if (error) throw error;
  }
  async function verifyOtp(email, token) {
    const c = await ensureClient();
    const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    user = data.user;
    emit();
    request(0);
  }
  async function signOut() {
    if (sb) await sb.auth.signOut();
    user = null;
    saveStore({ user: null, map: {}, del: [] });   // los planos locales se conservan
    state.notes = []; state.lastSync = null;
    setStatus('idle');
  }

  /* ---------- una ronda de sincronización ---------- */
  const T = () => sb.from(TABLE);
  const note = (key, params) => { state.notes = [{ key, params }, ...state.notes].slice(0, 5); };

  async function push(plan) {
    const { error } = await T().upsert({ id: plan.id, owner: user.id, name: plan.name || '', data: plan, updated_at: plan.updatedAt });
    if (error) throw error;
  }
  async function pull(id, row) {
    const { data, error } = await T().select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    const plan = data && normalize(data.data);
    if (!plan) return null;
    plan.id = id;
    plan.updatedAt = new Date(row.updated_at).toISOString();   // igual que la columna, así no hay ida y vuelta
    await savePlan(plan, { silent: true });
    return plan;
  }

  async function syncAll() {
    if (!user) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    if (running) { again = true; return; }
    running = true; setStatus('syncing');
    let changed = false;
    try {
      await ensureClient();
      const openId = hooks.getOpenId ? hooks.getOpenId() : null;   // plano abierto en el editor
      const st = loadStore();
      if (st.user !== user.id) { st.user = user.id; st.map = {}; st.del = []; }

      // 1. Borrados hechos acá mientras no había conexión o sesión
      for (const id of [...st.del]) {
        const { error } = await T().delete().eq('id', id);
        if (error) throw error;
        st.del = st.del.filter(x => x !== id); delete st.map[id];
      }

      // 2. Comparar listas
      const { data: rows, error } = await T().select('id,name,updated_at');
      if (error) throw error;
      const remote = new Map(rows.map(r => [r.id, r]));
      const local = new Map((await listPlans()).map(p => [p.id, p]));

      for (const id of new Set([...remote.keys(), ...local.keys()])) {
        const l = local.get(id), r = remote.get(id), base = st.map[id] ? Date.parse(st.map[id]) : null;

        if (l && !r) {
          if (!UUID.test(id)) continue;                                     // ids viejos/no-UUID: quedan solo locales
          if (base !== null && Date.parse(l.updatedAt) <= base) {           // ya estaba sincronizado y no se tocó: lo borraron en otro lado
            await removePlan(id, { silent: true }); delete st.map[id]; changed = true;
            note('sync.note.deletedElsewhere', { name: l.name || '' });
          } else { await push(l); st.map[id] = l.updatedAt; }               // nuevo (o editado desde que lo borraron): se sube
        } else if (!l && r) {
          const p = await pull(id, r);
          if (p) { st.map[id] = p.updatedAt; changed = true; }
        } else {
          const lt = Date.parse(l.updatedAt), rt = Date.parse(r.updated_at);
          if (lt === rt) { st.map[id] = l.updatedAt; continue; }
          const localMoved = base === null || lt > base, remoteMoved = base === null || rt > base;
          const diverged = base !== null && localMoved && remoteMoved;      // cambió de los dos lados desde la última vez
          if (lt > rt) {
            await push(l); st.map[id] = l.updatedAt;
            if (diverged) note('sync.note.localWon', { name: l.name || '' });
          } else if (id === openId) {
            /* el editor lo tiene abierto: se trae al volver al inicio (setOpen(null) pide otra ronda) */
          } else {
            const p = await pull(id, r);
            if (p) { st.map[id] = p.updatedAt; changed = true; }
            if (diverged) note('sync.note.remoteWon', { name: l.name || '' });
          }
        }
      }
      saveStore(st);
      state.lastSync = new Date();
      setStatus('idle');
    } catch (e) {
      console.error('[sync]', e);
      setStatus(navigator.onLine ? 'error' : 'offline', e && e.message ? e.message : String(e));
    } finally {
      running = false;
    }
    if (changed && hooks.onData) hooks.onData();
    if (again) { again = false; request(0); }
  }

  // Pide una ronda (con debounce). Cada guardado o borrado local la dispara.
  function request(delay = 2500) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(syncAll, delay);
  }

  onStorage('saved', () => request());
  onStorage('removed', id => {
    if (!user) return;
    const st = loadStore();
    if (st.map[id] !== undefined && !st.del.includes(id)) { st.del.push(id); saveStore(st); }   // solo si ya estaba en la nube
    request();
  });
  addEventListener('online', () => request(0));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') request(500); });

  // Con sesión guardada se conecta ya; si no, la librería recién se carga al pedir el ingreso.
  if (hasStoredSession()) ensureClient().then(() => request(0)).catch(e => setStatus('error', e.message));

  return {
    sendOtp, verifyOtp, signOut,
    syncNow: () => syncAll(),
    request,
    dismissNotes: () => { state.notes = []; emit(); },
    getUser: () => user,
    get state() { return { ...state, user }; }
  };
}
