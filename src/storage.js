// Persistencia. (Hito 1: un solo plano en localStorage; el hito 3 lo reemplaza por IndexedDB.)
import { normalize } from './state.js';

const KEY = 'bona-planos:draft';

export function loadDraft() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; }
}
export function saveDraft(plan) {
  try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch (e) { /* sin espacio o bloqueado */ }
}
