// Persistencia de planos en IndexedDB. Si IndexedDB no está disponible (algunos
// modos privados), cae a memoria: la app sigue andando pero no guarda entre sesiones.
import { normalize } from './state.js';

const DB = 'bona-planos', STORE = 'plans';
let dbPromise = null;
const memory = new Map();
export let persistent = true;

function open() {
  return dbPromise ??= new Promise(resolve => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = r.onblocked = () => { persistent = false; resolve(null); };
    } catch (e) { persistent = false; resolve(null); }
  });
}

async function run(mode, fn) {
  const db = await open();
  if (!db) return fn(null);
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function listPlans() {
  const all = await run('readonly', s => s ? s.getAll() : ([...memory.values()]));
  return all.map(normalize).filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function loadPlan(id) {
  const d = await run('readonly', s => s ? s.get(id) : (memory.get(id)));
  return d ? normalize(d) : null;
}
export async function savePlan(plan) {
  await run('readwrite', s => s ? s.put(plan) : (memory.set(plan.id, structuredClone(plan))));
}
export async function removePlan(id) {
  await run('readwrite', s => s ? s.delete(id) : (memory.delete(id)));
}

// Pide que el navegador no borre los planos por falta de espacio.
export async function requestPersistence() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; }
  catch (e) { return false; }
}
